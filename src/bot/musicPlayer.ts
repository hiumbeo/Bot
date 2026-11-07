import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  StreamType,
  entersState,
  type VoiceConnection,
  type AudioPlayer,
  type AudioResource,
} from '@discordjs/voice';
import type { TextChannel, VoiceBasedChannel, Message } from 'discord.js';
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { PassThrough } from 'stream';
import fs from 'fs';
import ffmpegStatic from 'ffmpeg-static';
import type { Track, LoopMode, AudioFilterMode } from './types.js';
import {
  buildMusicEmbed,
  buildMusicComponents,
  getNextAnimeGif,
  getCurrentAnimeGif,
} from './embeds.js';
import {
  getPlayableStreamUrl,
  findRelatedTrack,
  invalidateStreamCache,
  SC_BROWSER_HEADERS,
} from './audioResolver.js';

function resolveFfmpegBinary(): string {
  // Prefer ffmpeg-static or system ffmpeg, ensuring executable permissions on Linux hosts (Render/Railway)
  if (typeof ffmpegStatic === 'string' && ffmpegStatic.length > 0) {
    try {
      fs.chmodSync(ffmpegStatic, 0o755);
    } catch {}
    try {
      const checkStatic = spawnSync(ffmpegStatic, ['-version'], { stdio: 'ignore' });
      if (checkStatic.status === 0) return ffmpegStatic;
    } catch {}
  }
  try {
    const checkSys = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    if (checkSys.status === 0) return 'ffmpeg';
  } catch {}
  return typeof ffmpegStatic === 'string' && ffmpegStatic ? ffmpegStatic : 'ffmpeg';
}

const FFMPEG_BIN = resolveFfmpegBinary();

const AUDIO_FILTER_CHAINS: Record<AudioFilterMode, string> = {
  // Studio SoX 28-bit resampler + headroom + brickwall soft limiter to eliminate all clipping & static
  clear:
    'aresample=resampler=soxr:precision=28,highpass=f=25,volume=0.82,alimiter=limit=0.95:attack=5:release=50',
  bassboost:
    'aresample=resampler=soxr:precision=28,bass=g=8:f=110:w=0.6,volume=0.76,alimiter=limit=0.95:attack=5:release=50',
  nightcore:
    'aresample=48000,asetrate=48000*1.22,aresample=resampler=soxr:precision=24:osr=48000,volume=0.80,alimiter=limit=0.95:attack=5:release=50',
  lofi:
    'aresample=resampler=soxr:precision=28,lowpass=f=3800,highpass=f=80,aecho=0.8:0.88:60:0.25,volume=0.80,alimiter=limit=0.95:attack=5:release=50',
  '8d':
    'aresample=resampler=soxr:precision=28,apulsator=hz=0.125,volume=0.80,alimiter=limit=0.95:attack=5:release=50',
  vaporwave:
    'aresample=48000,asetrate=48000*0.84,aresample=resampler=soxr:precision=24:osr=48000,aecho=0.8:0.88:50:0.2,volume=0.80,alimiter=limit=0.95:attack=5:release=50',
  karaoke:
    'aresample=resampler=soxr:precision=28,stereotools=mlev=0.03,volume=0.85,alimiter=limit=0.95:attack=5:release=50',
  treble:
    'aresample=resampler=soxr:precision=28,treble=g=6:f=3500,highpass=f=60,volume=0.80,alimiter=limit=0.95:attack=5:release=50',
};

const FILTER_ORDER: AudioFilterMode[] = [
  'clear',
  'bassboost',
  'nightcore',
  'lofi',
  '8d',
  'vaporwave',
  'karaoke',
  'treble',
];

export interface GuildPlayer {
  guildId: string;
  connection: VoiceConnection | null;
  player: AudioPlayer | null;
  activeResource: AudioResource | null;
  ffmpegProcess: ChildProcess | null;
  streamAbort: AbortController | null;
  bufferStream: PassThrough | null;
  queue: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  loopMode: LoopMode;
  filterMode: AudioFilterMode;
  autoplay: boolean;
  stay247: boolean;
  volume: number;
  textChannel: TextChannel | null;
  panelMessage: Message | null;
  playStartTime: number;
  currentPlaybackSeconds: number;
  progressInterval: NodeJS.Timeout | null;
  panelUpdateTimeout: NodeJS.Timeout | null;
  customBannerUrl?: string;
  activeAnimeGif?: string;
  isTransitioning: boolean;
  recentTrackIds: Set<string>;
}

export class MusicManager {
  private players = new Map<string, GuildPlayer>();

  getPlayer(guildId: string): GuildPlayer {
    let gp = this.players.get(guildId);
    if (!gp) {
      gp = {
        guildId,
        connection: null,
        player: null,
        activeResource: null,
        ffmpegProcess: null,
        streamAbort: null,
        bufferStream: null,
        queue: [],
        currentTrack: null,
        isPlaying: false,
        loopMode: 'off',
        filterMode: 'clear',
        autoplay: false,
        stay247: false,
        volume: 100,
        textChannel: null,
        panelMessage: null,
        playStartTime: 0,
        currentPlaybackSeconds: 0,
        progressInterval: null,
        panelUpdateTimeout: null,
        activeAnimeGif: getCurrentAnimeGif(),
        isTransitioning: false,
        recentTrackIds: new Set<string>(),
      };
      this.players.set(guildId, gp);
    }
    return gp;
  }

  getAllPlayers(): Map<string, GuildPlayer> {
    return this.players;
  }

  private killFfmpeg(gp: GuildPlayer) {
    if (gp.streamAbort) {
      try {
        gp.streamAbort.abort();
      } catch {}
      gp.streamAbort = null;
    }
    if (gp.ffmpegProcess) {
      try {
        gp.ffmpegProcess.stdin?.destroy();
        gp.ffmpegProcess.stdout?.unpipe();
        gp.ffmpegProcess.kill('SIGKILL');
      } catch {}
      gp.ffmpegProcess = null;
    }
    if (gp.bufferStream) {
      try {
        gp.bufferStream.destroy();
      } catch {}
      gp.bufferStream = null;
    }
  }

  /**
   * Node.js Native HTTP/HLS Audio Pump -> FFmpeg stdin (pipe:0).
   * Bypasses ffmpeg-static's broken gnutls HLS networking on Render/Railway/Cloud hosts
   * by downloading HLS fMP4 segments or progressive streams via Node's native OpenSSL fetch()
   * and piping raw media bytes straight into FFmpeg stdin!
   */
  private async pumpStreamToFfmpegStdin(
    streamUrl: string,
    ffmpeg: ChildProcess,
    signal: AbortSignal,
    seekSeconds: number
  ): Promise<boolean> {
    const stdin = ffmpeg.stdin;
    if (!stdin) return false;

    stdin.on('error', () => {});

    const writeChunk = (buf: Buffer): Promise<boolean> => {
      return new Promise((resolve) => {
        if (signal.aborted || !stdin.writable) return resolve(false);
        const canContinue = stdin.write(buf);
        if (canContinue) {
          resolve(true);
        } else {
          const onDrain = () => {
            cleanup();
            resolve(true);
          };
          const onClose = () => {
            cleanup();
            resolve(false);
          };
          const cleanup = () => {
            stdin.removeListener('drain', onDrain);
            stdin.removeListener('close', onClose);
            stdin.removeListener('error', onClose);
          };
          stdin.once('drain', onDrain);
          stdin.once('close', onClose);
          stdin.once('error', onClose);
        }
      });
    };

    try {
      const initialRes = await fetch(streamUrl, {
        headers: SC_BROWSER_HEADERS,
        signal,
      });

      if (!initialRes.ok) {
        return false;
      }

      const contentType = (initialRes.headers.get('content-type') || '').toLowerCase();
      const isM3u8 =
        streamUrl.includes('.m3u8') ||
        contentType.includes('mpegurl') ||
        contentType.includes('vnd.apple.mpegurl');

      if (isM3u8) {
        const m3u8Text = await initialRes.text();
        if (!m3u8Text.includes('#EXTM3U')) {
          return false;
        }

        const resolveRelative = (u: string): string => {
          if (u.startsWith('http://') || u.startsWith('https://')) return u;
          try {
            return new URL(u, streamUrl).toString();
          } catch {
            return u;
          }
        };

        let initMapUrl: string | null = null;
        const mapMatch = m3u8Text.match(/#EXT-X-MAP:URI="([^"]+)"/);
        if (mapMatch && mapMatch[1]) {
          initMapUrl = resolveRelative(mapMatch[1]);
        }

        const segments: { url: string; duration: number }[] = [];
        let nextDur = 10;
        for (const rawLine of m3u8Text.split('\n')) {
          const line = rawLine.trim();
          if (!line) continue;
          if (line.startsWith('#EXTINF:')) {
            const durVal = parseFloat(line.slice(8).split(',')[0]);
            if (!isNaN(durVal) && durVal > 0) nextDur = durVal;
          } else if (!line.startsWith('#')) {
            segments.push({ url: resolveRelative(line), duration: nextDur });
            nextDur = 10;
          }
        }

        // 1. Always write fMP4 initialization segment (#EXT-X-MAP) first if present
        if (initMapUrl) {
          const initRes = await fetch(initMapUrl, { headers: SC_BROWSER_HEADERS, signal });
          if (initRes.ok) {
            const initBuf = Buffer.from(await initRes.arrayBuffer());
            const ok = await writeChunk(initBuf);
            if (!ok) return true;
          }
        }

        // 2. Calculate starting segment if user requested .seek
        let startIndex = 0;
        if (seekSeconds > 0 && segments.length > 1) {
          let acc = 0;
          for (let i = 0; i < segments.length; i++) {
            if (acc + segments[i].duration > seekSeconds) {
              startIndex = i;
              break;
            }
            acc += segments[i].duration;
          }
        }

        // 3. Stream segments sequentially with 1-segment lookahead prefetch
        let prefetchPromise: Promise<Buffer | null> | null = null;
        const fetchSegmentBuffer = async (url: string): Promise<Buffer | null> => {
          try {
            const segRes = await fetch(url, { headers: SC_BROWSER_HEADERS, signal });
            if (!segRes.ok) return null;
            return Buffer.from(await segRes.arrayBuffer());
          } catch {
            return null;
          }
        };

        for (let i = startIndex; i < segments.length; i++) {
          if (signal.aborted || !stdin.writable) break;

          const currentPromise = prefetchPromise || fetchSegmentBuffer(segments[i].url);
          if (i + 1 < segments.length) {
            prefetchPromise = fetchSegmentBuffer(segments[i + 1].url);
          } else {
            prefetchPromise = null;
          }

          const segBuf = await currentPromise;
          if (!segBuf || signal.aborted) break;

          const ok = await writeChunk(segBuf);
          if (!ok) break;
        }

        if (!signal.aborted && stdin.writable) {
          stdin.end();
        }
        return true;
      } else {
        // Progressive HTTP audio stream (.mp3, .m4a, .ogg, .webm)
        if (!initialRes.body) return false;
        const reader = initialRes.body.getReader();
        while (!signal.aborted && stdin.writable) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            const ok = await writeChunk(Buffer.from(value));
            if (!ok) break;
          }
        }
        if (!signal.aborted && stdin.writable) {
          stdin.end();
        }
        return true;
      }
    } catch (err: any) {
      if (!signal.aborted) {
        console.warn('[MusicPlayer] Stream pump notice:', err?.message || err);
      }
      try {
        if (stdin.writable) stdin.end();
      } catch {}
      return false;
    }
  }

  async connectToVoice(
    channel: VoiceBasedChannel,
    textChannel?: TextChannel
  ): Promise<GuildPlayer> {
    const gp = this.getPlayer(channel.guild.id);
    if (textChannel) gp.textChannel = textChannel;

    const needsNewConnection =
      !gp.connection ||
      gp.connection.state.status === VoiceConnectionStatus.Destroyed ||
      gp.connection.state.status === VoiceConnectionStatus.Disconnected ||
      gp.connection.joinConfig.channelId !== channel.id;

    if (needsNewConnection) {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator as any,
        selfDeaf: false,
        selfMute: false,
      });

      gp.connection = connection;

      // Auto-recover voice connection on temporary network/region handoffs
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          if (!gp.stay247) {
            try {
              connection.destroy();
            } catch {}
          }
        }
      });

      if (!gp.player) {
        const player = createAudioPlayer({
          behaviors: {
            noSubscriber: NoSubscriberBehavior.Play,
          },
        });
        gp.player = player;

        player.on(AudioPlayerStatus.Playing, () => {
          gp.isPlaying = true;
          gp.isTransitioning = false;
          this.schedulePanelUpdate(channel.guild.id, false);
        });

        player.on(AudioPlayerStatus.Idle, () => {
          if (!gp.isTransitioning) {
            this.handleTrackEnd(channel.guild.id);
          }
        });

        player.on('error', (err) => {
          console.error(`[AudioPlayer Error] Guild ${channel.guild.id}:`, err.message);
          if (!gp.isTransitioning) {
            this.handleTrackEnd(channel.guild.id);
          }
        });
      }

      connection.subscribe(gp.player);

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      } catch (connErr) {
        console.warn(`[Voice Connection] Ready state wait notice:`, connErr);
      }
    } else if (gp.player && gp.connection) {
      gp.connection.subscribe(gp.player);
    }

    return gp;
  }

  private prefetchNextTrack(guildId: string) {
    const gp = this.getPlayer(guildId);
    const nextTrack = gp.queue[0];
    if (nextTrack && !nextTrack.streamUrl) {
      getPlayableStreamUrl(nextTrack).catch(() => {});
    }
  }

  async enqueue(
    guildId: string,
    track: Track,
    channel?: VoiceBasedChannel,
    textChannel?: TextChannel
  ): Promise<{ gp: GuildPlayer; startedImmediately: boolean }> {
    const gp = this.getPlayer(guildId);
    if (textChannel) gp.textChannel = textChannel;

    if (channel) {
      await this.connectToVoice(channel, textChannel);
    }

    if (!gp.currentTrack && !gp.isPlaying) {
      gp.currentTrack = track;
      gp.activeAnimeGif = getNextAnimeGif();
      await this.playTrack(guildId, track, 0);
      return { gp, startedImmediately: true };
    } else {
      gp.queue.push(track);
      this.prefetchNextTrack(guildId);
      this.schedulePanelUpdate(guildId, false);
      return { gp, startedImmediately: false };
    }
  }

  async playTrack(guildId: string, track: Track, seekSeconds = 0, isRetry = false) {
    const gp = this.getPlayer(guildId);
    gp.isTransitioning = true;
    gp.currentTrack = track;
    gp.isPlaying = true;
    gp.playStartTime = Date.now() - seekSeconds * 1000;
    gp.currentPlaybackSeconds = seekSeconds;

    if (track.id) {
      gp.recentTrackIds.add(track.id);
      if (gp.recentTrackIds.size > 30) {
        const first = gp.recentTrackIds.values().next().value;
        if (first) gp.recentTrackIds.delete(first);
      }
    }

    this.killFfmpeg(gp);

    if (gp.progressInterval) clearInterval(gp.progressInterval);
    gp.progressInterval = setInterval(() => {
      if (gp.isPlaying && gp.currentTrack) {
        gp.currentPlaybackSeconds += 1;
        // Update progress bar every 15s without spamming Discord API
        if (gp.currentPlaybackSeconds % 15 === 0) {
          this.schedulePanelUpdate(guildId, false);
        }
      }
    }, 1000);

    try {
      const streamUrl = await getPlayableStreamUrl(track);
      if (!streamUrl) {
        console.error(`[MusicPlayer] Could not resolve playable stream URL for "${track.title}"`);
        gp.isTransitioning = false;
        this.handleTrackEnd(guildId);
        return;
      }

      // Pre-fetch the next song in queue in the background for 0ms transitions
      this.prefetchNextTrack(guildId);

      if (gp.player) {
        const filterChain = AUDIO_FILTER_CHAINS[gp.filterMode] || AUDIO_FILTER_CHAINS.clear;
        const isHlsUrl = streamUrl.includes('.m3u8');

        const ffmpegArgs: string[] = [
          '-thread_queue_size',
          '4096',
          '-probesize',
          '128k',
          '-analyzeduration',
          '1000000',
        ];

        // For progressive streams, let FFmpeg handle byte-seeking; for HLS, our pump jumps directly to the target segment
        if (seekSeconds > 0 && !isHlsUrl) {
          ffmpegArgs.push('-ss', String(seekSeconds));
        }

        ffmpegArgs.push(
          '-i',
          'pipe:0',
          '-vn',
          '-af',
          filterChain,
          '-f',
          's16le',
          '-ar',
          '48000',
          '-ac',
          '2',
          '-loglevel',
          'error',
          'pipe:1'
        );

        const abortController = new AbortController();
        gp.streamAbort = abortController;

        const ffmpeg = spawn(FFMPEG_BIN, ffmpegArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        ffmpeg.on('error', (err) => {
          console.error('[FFmpeg Spawn Error]:', err.message);
        });

        // 16MB RAM PassThrough buffer prevents 64KB OS pipe backpressure from stalling downloads
        const ramBuffer = new PassThrough({
          highWaterMark: 16 * 1024 * 1024,
        });

        ffmpeg.stdout.pipe(ramBuffer);

        gp.ffmpegProcess = ffmpeg;
        gp.bufferStream = ramBuffer;

        // Start pumping HTTP/HLS audio bytes from Node.js fetch() into FFmpeg stdin
        this.pumpStreamToFfmpegStdin(
          streamUrl,
          ffmpeg,
          abortController.signal,
          isHlsUrl ? seekSeconds : 0
        ).then((ok) => {
          if (!ok && !abortController.signal.aborted && !isRetry) {
            console.warn(`[MusicPlayer] Stream URL expired or blocked, refreshing URL for "${track.title}"...`);
            invalidateStreamCache(track);
            this.playTrack(guildId, track, seekSeconds, true);
          }
        });

        const resource = createAudioResource(ramBuffer, {
          inputType: StreamType.Raw,
          inlineVolume: true,
          silencePaddingFrames: 5,
        });

        const normalizedVol = Math.min(1.5, Math.max(0, gp.volume / 100));
        resource.volume?.setVolume(normalizedVol);
        gp.activeResource = resource;

        if (gp.connection) {
          gp.connection.subscribe(gp.player);
        }

        gp.player.play(resource);
        setTimeout(() => {
          gp.isTransitioning = false;
        }, 1200);

        console.log(
          `[MusicPlayer] Node.js Pipe -> SoX 28-bit stream active: "${track.title}" [EQ: ${gp.filterMode}]`
        );
      }
    } catch (e) {
      console.error('[MusicPlayer] Playback error:', e);
      gp.isTransitioning = false;
    }

    this.schedulePanelUpdate(guildId, false);
  }

  async handleTrackEnd(guildId: string) {
    const gp = this.getPlayer(guildId);
    if (gp.progressInterval) {
      clearInterval(gp.progressInterval);
      gp.progressInterval = null;
    }
    this.killFfmpeg(gp);
    gp.activeResource = null;

    const finishedTrack = gp.currentTrack;
    if (!finishedTrack) return;

    if (gp.loopMode === 'track') {
      gp.activeAnimeGif = getNextAnimeGif();
      await this.playTrack(guildId, finishedTrack, 0);
      return;
    }

    if (gp.loopMode === 'queue') {
      gp.queue.push(finishedTrack);
    }

    const next = gp.queue.shift();
    if (next) {
      gp.activeAnimeGif = getNextAnimeGif();
      await this.playTrack(guildId, next, 0);
      return;
    }

    // If queue is empty and Autoplay is enabled, automatically find a related song!
    if (gp.autoplay) {
      const related = await findRelatedTrack(finishedTrack, gp.recentTrackIds);
      if (related) {
        gp.activeAnimeGif = getNextAnimeGif();
        await this.playTrack(guildId, related, 0);
        return;
      }
    }

    gp.currentTrack = null;
    gp.isPlaying = false;
    gp.currentPlaybackSeconds = 0;
    gp.activeAnimeGif = getNextAnimeGif();
    this.schedulePanelUpdate(guildId, false);
  }

  togglePlay(guildId: string): boolean {
    const gp = this.getPlayer(guildId);
    if (!gp.currentTrack) return false;
    if (gp.isPlaying) {
      gp.isPlaying = false;
      gp.player?.pause();
    } else {
      gp.isPlaying = true;
      gp.player?.unpause();
    }
    this.schedulePanelUpdate(guildId, false);
    return gp.isPlaying;
  }

  seek(guildId: string, seconds: number): boolean {
    const gp = this.getPlayer(guildId);
    if (!gp.currentTrack) return false;
    const clamped = Math.max(0, Math.min(gp.currentTrack.durationSeconds - 2, seconds));
    this.playTrack(guildId, gp.currentTrack, clamped);
    return true;
  }

  toggleAutoplay(guildId: string): boolean {
    const gp = this.getPlayer(guildId);
    gp.autoplay = !gp.autoplay;
    this.schedulePanelUpdate(guildId, false);
    return gp.autoplay;
  }

  toggle247(guildId: string): boolean {
    const gp = this.getPlayer(guildId);
    gp.stay247 = !gp.stay247;
    this.schedulePanelUpdate(guildId, false);
    return gp.stay247;
  }

  skip(guildId: string): Track | null {
    const gp = this.getPlayer(guildId);
    const skipped = gp.currentTrack;
    gp.isTransitioning = true;
    if (gp.progressInterval) {
      clearInterval(gp.progressInterval);
      gp.progressInterval = null;
    }
    this.killFfmpeg(gp);

    const next = gp.queue.shift();
    if (next) {
      gp.activeAnimeGif = getNextAnimeGif();
      this.playTrack(guildId, next, 0);
    } else if (gp.autoplay && skipped) {
      gp.activeAnimeGif = getNextAnimeGif();
      findRelatedTrack(skipped, gp.recentTrackIds).then((rel) => {
        if (rel) {
          this.playTrack(guildId, rel, 0);
        } else {
          gp.currentTrack = null;
          gp.isPlaying = false;
          gp.currentPlaybackSeconds = 0;
          gp.activeResource = null;
          gp.player?.stop(true);
          gp.isTransitioning = false;
          this.schedulePanelUpdate(guildId, false);
        }
      });
    } else {
      gp.currentTrack = null;
      gp.isPlaying = false;
      gp.currentPlaybackSeconds = 0;
      gp.activeResource = null;
      gp.player?.stop(true);
      gp.isTransitioning = false;
      gp.activeAnimeGif = getNextAnimeGif();
      this.schedulePanelUpdate(guildId, false);
    }
    return skipped;
  }

  cycleLoop(guildId: string): LoopMode {
    const gp = this.getPlayer(guildId);
    if (gp.loopMode === 'off') gp.loopMode = 'track';
    else if (gp.loopMode === 'track') gp.loopMode = 'queue';
    else gp.loopMode = 'off';

    this.schedulePanelUpdate(guildId, false);
    return gp.loopMode;
  }

  setLoopMode(guildId: string, mode: LoopMode): LoopMode {
    const gp = this.getPlayer(guildId);
    gp.loopMode = mode;
    this.schedulePanelUpdate(guildId, false);
    return gp.loopMode;
  }

  cycleFilter(guildId: string): AudioFilterMode {
    const gp = this.getPlayer(guildId);
    const idx = FILTER_ORDER.indexOf(gp.filterMode);
    const nextFilter = FILTER_ORDER[(idx + 1) % FILTER_ORDER.length];
    return this.setFilter(guildId, nextFilter);
  }

  setFilter(guildId: string, mode: AudioFilterMode): AudioFilterMode {
    const gp = this.getPlayer(guildId);
    gp.filterMode = mode;
    if (gp.currentTrack && gp.isPlaying) {
      this.playTrack(guildId, gp.currentTrack, gp.currentPlaybackSeconds);
    } else {
      this.schedulePanelUpdate(guildId, false);
    }
    return gp.filterMode;
  }

  setVolume(guildId: string, change: number): number {
    const gp = this.getPlayer(guildId);
    gp.volume = Math.max(0, Math.min(150, gp.volume + change));
    gp.activeResource?.volume?.setVolume(gp.volume / 100);
    this.schedulePanelUpdate(guildId, false);
    return gp.volume;
  }

  setCustomBanner(guildId: string, bannerUrl: string) {
    const gp = this.getPlayer(guildId);
    if (!bannerUrl || bannerUrl === 'auto' || bannerUrl === 'random') {
      gp.customBannerUrl = undefined;
      gp.activeAnimeGif = getNextAnimeGif();
    } else {
      gp.customBannerUrl = bannerUrl;
      gp.activeAnimeGif = bannerUrl;
    }
    this.schedulePanelUpdate(guildId, true);
  }

  shuffle(guildId: string): number {
    const gp = this.getPlayer(guildId);
    for (let i = gp.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [gp.queue[i], gp.queue[j]] = [gp.queue[j], gp.queue[i]];
    }
    this.prefetchNextTrack(guildId);
    this.schedulePanelUpdate(guildId, false);
    return gp.queue.length;
  }

  remove(guildId: string, index: number): Track | null {
    const gp = this.getPlayer(guildId);
    if (index >= 0 && index < gp.queue.length) {
      const [removed] = gp.queue.splice(index, 1);
      this.schedulePanelUpdate(guildId, false);
      return removed;
    }
    return null;
  }

  clearQueue(guildId: string): void {
    const gp = this.getPlayer(guildId);
    gp.queue = [];
    this.schedulePanelUpdate(guildId, false);
  }

  leave(guildId: string): void {
    const gp = this.getPlayer(guildId);
    gp.isTransitioning = true;
    gp.stay247 = false;
    if (gp.progressInterval) clearInterval(gp.progressInterval);
    this.killFfmpeg(gp);
    gp.player?.stop(true);
    try {
      gp.connection?.destroy();
    } catch {}
    gp.connection = null;
    gp.player = null;
    gp.activeResource = null;
    gp.currentTrack = null;
    gp.isPlaying = false;
    gp.queue = [];
    gp.currentPlaybackSeconds = 0;
    gp.isTransitioning = false;
    this.schedulePanelUpdate(guildId, false);
  }

  async sendOrAttachPanel(
    guildId: string,
    textChannel: TextChannel,
    customImageUrl?: string
  ): Promise<Message> {
    const gp = this.getPlayer(guildId);
    gp.textChannel = textChannel;
    if (customImageUrl && customImageUrl.startsWith('http')) {
      gp.customBannerUrl = customImageUrl;
      gp.activeAnimeGif = customImageUrl;
    } else if (!gp.customBannerUrl) {
      gp.activeAnimeGif = getNextAnimeGif();
    }

    if (gp.panelMessage) {
      try {
        await gp.panelMessage.delete();
      } catch {}
      gp.panelMessage = null;
    }

    const bannerToUse = gp.customBannerUrl || gp.activeAnimeGif || getNextAnimeGif();

    const embed = buildMusicEmbed(
      gp.currentTrack,
      gp.queue,
      gp.isPlaying,
      gp.loopMode,
      gp.volume,
      gp.currentPlaybackSeconds,
      bannerToUse,
      false,
      gp.filterMode,
      gp.autoplay,
      gp.stay247
    );
    const components = buildMusicComponents(
      gp.isPlaying,
      gp.loopMode,
      gp.filterMode,
      gp.autoplay
    );

    const msg = await textChannel.send({
      embeds: [embed],
      components,
    });
    gp.panelMessage = msg;

    return msg;
  }

  schedulePanelUpdate(guildId: string, rotateGif = false) {
    const gp = this.getPlayer(guildId);
    if (rotateGif && !gp.customBannerUrl) {
      gp.activeAnimeGif = getNextAnimeGif();
    }
    if (gp.panelUpdateTimeout) {
      clearTimeout(gp.panelUpdateTimeout);
    }
    gp.panelUpdateTimeout = setTimeout(() => {
      gp.panelUpdateTimeout = null;
      this.updatePanel(guildId);
    }, 350);
  }

  async updatePanel(guildId: string) {
    const gp = this.getPlayer(guildId);
    if (!gp.panelMessage || !gp.textChannel) return;

    try {
      const bannerToUse = gp.customBannerUrl || gp.activeAnimeGif || getCurrentAnimeGif();

      const embed = buildMusicEmbed(
        gp.currentTrack,
        gp.queue,
        gp.isPlaying,
        gp.loopMode,
        gp.volume,
        gp.currentPlaybackSeconds,
        bannerToUse,
        false,
        gp.filterMode,
        gp.autoplay,
        gp.stay247
      );
      const components = buildMusicComponents(
        gp.isPlaying,
        gp.loopMode,
        gp.filterMode,
        gp.autoplay
      );

      await gp.panelMessage.edit({
        embeds: [embed],
        components,
      });
    } catch {
      gp.panelMessage = null;
    }
  }
}

export const musicManager = new MusicManager();
