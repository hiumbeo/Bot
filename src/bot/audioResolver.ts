import type { Track, Platform } from './types.js';
// @ts-ignore
import ytSearch from 'yt-search';
// @ts-ignore
import { Ytdl, chooseFormat } from '@distube/ytdl-core';

const ytdl = new Ytdl();

// Cached SoundCloud client_id (auto-refreshed if expired)
let cachedScClientId = '39AVoiZVrdvJEMFLH8T0c5WGshQaAPRJ';

// High-speed TTL Caches for 0ms repeat/EQ/seek & reduced API overhead
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry<Track>>();
const streamCache = new Map<string, CacheEntry<string>>();
let totalCacheHits = 0;

const SEARCH_TTL_MS = 30 * 60 * 1000; // 30 minutes
const STREAM_TTL_MS = 12 * 60 * 1000; // 12 minutes (CDN signed URLs last ~15-30m)

export function getResolverCacheStats() {
  return {
    searchCacheSize: searchCache.size,
    streamCacheSize: streamCache.size,
    cacheHits: totalCacheHits,
  };
}

function getCached<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    map.delete(key);
    return null;
  }
  totalCacheHits++;
  return entry.value;
}

function setCached<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  if (map.size > 300) {
    const oldestKey = map.keys().next().value;
    if (oldestKey) map.delete(oldestKey);
  }
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function getSoundCloudClientId(forceRefresh = false): Promise<string> {
  if (cachedScClientId && !forceRefresh) return cachedScClientId;
  try {
    const html = await fetch('https://soundcloud.com').then((r) => r.text());
    const scripts = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(
      (m) => m[1]
    );
    for (const s of scripts.slice(-6)) {
      const js = await fetch(s).then((r) => r.text());
      const m = js.match(/client_id:"([a-zA-Z0-9]{32})"/);
      if (m && m[1]) {
        cachedScClientId = m[1];
        return cachedScClientId;
      }
    }
  } catch (err) {
    console.warn('[AudioResolver] Failed to scrape fresh SoundCloud client_id:', err);
  }
  return cachedScClientId;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Resolves a playable HTTP audio stream URL from a SoundCloud track object
 */
async function extractScStreamUrl(scTrack: any, clientId: string): Promise<string | null> {
  if (!scTrack?.media?.transcodings?.length) return null;
  const transcodings: any[] = [...scTrack.media.transcodings];

  const score = (t: any): number => {
    if (t.preset === 'abr_sq') return 0;
    if (t.format?.protocol === 'progressive') return 100;
    if (t.preset?.includes('160k') || t.quality === 'hq') return 90;
    if (t.quality === 'sq') return 80;
    if (t.format?.protocol === 'hls') return 60;
    return 10;
  };

  transcodings.sort((a, b) => score(b) - score(a));

  for (const chosen of transcodings) {
    if (!chosen?.url) continue;
    try {
      const sep = chosen.url.includes('?') ? '&' : '?';
      const res = await fetch(`${chosen.url}${sep}client_id=${clientId}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { url?: string };
      if (data.url) return data.url;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Searches SoundCloud API v2 for a query and returns the top track + playable stream URL
 */
export async function resolveSoundCloudStreamByQuery(
  query: string
): Promise<{ streamUrl: string; scTrack: any } | null> {
  for (const force of [false, true]) {
    try {
      const clientId = await getSoundCloudClientId(force);
      const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(
        query
      )}&client_id=${clientId}&limit=5`;
      const res = await fetch(searchUrl);
      if (res.status === 401 || res.status === 403) continue;
      if (!res.ok) return null;

      const data = (await res.json()) as { collection?: any[] };
      if (!data.collection || data.collection.length === 0) return null;

      for (const item of data.collection) {
        const streamUrl = await extractScStreamUrl(item, clientId);
        if (streamUrl) {
          return { streamUrl, scTrack: item };
        }
      }
    } catch (err) {
      console.warn('[AudioResolver] SoundCloud search attempt error:', err);
    }
  }
  return null;
}

/**
 * Resolves a direct SoundCloud URL via SoundCloud API v2
 */
async function resolveSoundCloudDirectUrl(
  scUrl: string
): Promise<{ streamUrl: string; scTrack: any } | null> {
  for (const force of [false, true]) {
    try {
      const clientId = await getSoundCloudClientId(force);
      const apiUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(
        scUrl
      )}&client_id=${clientId}`;
      const res = await fetch(apiUrl);
      if (res.status === 401 || res.status === 403) continue;
      if (!res.ok) return null;

      const item = await res.json();
      const trackObj = item.kind === 'playlist' && item.tracks?.length ? item.tracks[0] : item;
      const streamUrl = await extractScStreamUrl(trackObj, clientId);
      if (streamUrl) {
        return { streamUrl, scTrack: trackObj };
      }
    } catch {}
  }
  return null;
}

/**
 * Resolves a fresh playable stream URL right before playback begins
 * Uses a 12-minute TTL cache so EQ changes, seeking, and loops are instant (0ms)
 */
export async function getPlayableStreamUrl(track: Track): Promise<string | null> {
  if (track.platform === 'direct' && track.streamUrl) {
    return track.streamUrl;
  }

  const cacheKey = track.id || track.url || track.title;
  const cachedStream = getCached(streamCache, cacheKey);
  if (cachedStream) {
    return cachedStream;
  }

  if (
    track.streamUrl &&
    track.streamResolvedAt &&
    Date.now() - track.streamResolvedAt < STREAM_TTL_MS
  ) {
    setCached(streamCache, cacheKey, track.streamUrl, STREAM_TTL_MS);
    return track.streamUrl;
  }

  // 1. If it's a direct SoundCloud URL
  if (track.url.includes('soundcloud.com')) {
    const resolved = await resolveSoundCloudDirectUrl(track.url);
    if (resolved?.streamUrl) {
      track.streamUrl = resolved.streamUrl;
      track.streamResolvedAt = Date.now();
      setCached(streamCache, cacheKey, resolved.streamUrl, STREAM_TTL_MS);
      return resolved.streamUrl;
    }
  }

  // 2. Search SoundCloud by clean title + author
  const cleanTitle = track.title
    .replace(
      /\(official.*?\)|\[official.*?\]|official music video|official video|official audio|mv|lyrics|lyric video/gi,
      ''
    )
    .trim();
  const searchCandidates = [
    `${cleanTitle} ${track.author || ''}`.trim(),
    cleanTitle,
    track.title,
  ];

  for (const candidate of searchCandidates) {
    if (!candidate) continue;
    const scResolved = await resolveSoundCloudStreamByQuery(candidate);
    if (scResolved?.streamUrl) {
      track.streamUrl = scResolved.streamUrl;
      track.streamResolvedAt = Date.now();
      setCached(streamCache, cacheKey, scResolved.streamUrl, STREAM_TTL_MS);
      return scResolved.streamUrl;
    }
  }

  // 3. Fallback: try @distube/ytdl-core direct format URL
  if (track.url.includes('youtube.com') || track.url.includes('youtu.be')) {
    try {
      const info = await ytdl.getInfo(track.url);
      const format = chooseFormat(info.formats, {
        filter: { hasAudio: true, hasVideo: false },
      });
      if (format?.url) {
        track.streamUrl = format.url;
        track.streamResolvedAt = Date.now();
        setCached(streamCache, cacheKey, format.url, STREAM_TTL_MS);
        return format.url;
      }
    } catch (ytErr: any) {
      console.warn(
        '[AudioResolver] YouTube direct getInfo blocked, using fallback stream:',
        ytErr?.message
      );
    }
  }

  return track.streamUrl || null;
}

export async function searchAndResolveTrack(
  query: string,
  requester: string
): Promise<Track | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const normKey = trimmed.toLowerCase();
  const cachedTrack = getCached(searchCache, normKey);
  if (cachedTrack) {
    return { ...cachedTrack, requester };
  }

  let platform: Platform = 'youtube';
  let searchQuery = trimmed;

  // 1. Direct audio file link (.mp3, .wav, .ogg, .m4a, .aac)
  if (trimmed.match(/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i)) {
    return {
      id: `direct_${Date.now()}`,
      title: trimmed.split('/').pop()?.split('?')[0] || 'Direct Audio Stream',
      url: trimmed,
      streamUrl: trimmed,
      streamResolvedAt: Date.now(),
      duration: 'Live',
      durationSeconds: 240,
      thumbnail: 'https://cdn-icons-png.flaticon.com/512/3844/3844724.png',
      author: 'Direct Stream',
      platform: 'direct',
      requester,
    };
  }

  // 2. Direct SoundCloud link
  if (trimmed.includes('soundcloud.com')) {
    platform = 'soundcloud';
    const scDirect = await resolveSoundCloudDirectUrl(trimmed);
    if (scDirect) {
      const t = scDirect.scTrack;
      const durSec = Math.max(1, Math.round((t.duration || 180000) / 1000));
      const track: Track = {
        id: `sc_${t.id || Date.now()}`,
        title: t.title || 'SoundCloud Track',
        url: t.permalink_url || trimmed,
        streamUrl: scDirect.streamUrl,
        streamResolvedAt: Date.now(),
        duration: formatDuration(durSec),
        durationSeconds: durSec,
        thumbnail:
          (t.artwork_url ? t.artwork_url.replace('-large', '-t500x500') : null) ||
          'https://cdn-icons-png.flaticon.com/512/145/145809.png',
        author: t.user?.username || 'SoundCloud Artist',
        platform: 'soundcloud',
        requester,
      };
      setCached(searchCache, normKey, track, SEARCH_TTL_MS);
      setCached(streamCache, track.id, scDirect.streamUrl, STREAM_TTL_MS);
      return track;
    }
  }

  // 3. Spotify Link -> Resolve exact song title & artist via Spotify oEmbed
  if (trimmed.includes('spotify.com')) {
    platform = 'spotify';
    try {
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(trimmed)}`;
      const spRes = await fetch(oembedUrl);
      if (spRes.ok) {
        const spData = (await spRes.json()) as { title?: string; thumbnail_url?: string };
        if (spData.title) {
          searchQuery = spData.title;
        }
      }
    } catch {}
  }

  // 4. YouTube Link -> Try oEmbed first for instant title/author if it's a direct link
  if (trimmed.includes('youtube.com/watch') || trimmed.includes('youtu.be/')) {
    platform = 'youtube';
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
        trimmed
      )}&format=json`;
      const ytRes = await fetch(oembedUrl);
      if (ytRes.ok) {
        const ytData = (await ytRes.json()) as {
          title?: string;
          author_name?: string;
          thumbnail_url?: string;
        };
        if (ytData.title) {
          searchQuery = `${ytData.title} ${ytData.author_name || ''}`.trim();
        }
      }
    } catch {}
  }

  // 5. Run YouTube Search & SoundCloud Search in parallel for maximum speed and reliability
  try {
    const [ytResults, scResult] = await Promise.all([
      ytSearch(searchQuery).catch(() => null),
      resolveSoundCloudStreamByQuery(searchQuery).catch(() => null),
    ]);

    const topYt = ytResults?.videos?.[0];
    const scTrack = scResult?.scTrack;

    if (topYt || scTrack) {
      const durSec = scTrack?.duration
        ? Math.max(1, Math.round(scTrack.duration / 1000))
        : topYt?.seconds || 210;

      const artwork =
        topYt?.thumbnail ||
        (scTrack?.artwork_url ? scTrack.artwork_url.replace('-large', '-t500x500') : null) ||
        'https://cdn-icons-png.flaticon.com/512/1384/1384060.png';

      const track: Track = {
        id: topYt?.videoId || `sc_${scTrack?.id || Date.now()}`,
        title: topYt?.title || scTrack?.title || searchQuery,
        url: topYt?.url || scTrack?.permalink_url || `https://soundcloud.com`,
        streamUrl: scResult?.streamUrl,
        streamResolvedAt: scResult?.streamUrl ? Date.now() : undefined,
        duration: formatDuration(durSec),
        durationSeconds: durSec,
        thumbnail: artwork,
        author: topYt?.author?.name || scTrack?.user?.username || 'Music Artist',
        platform,
        requester,
      };

      setCached(searchCache, normKey, track, SEARCH_TTL_MS);
      if (scResult?.streamUrl) {
        setCached(streamCache, track.id, scResult.streamUrl, STREAM_TTL_MS);
      }
      return track;
    }
  } catch (err) {
    console.warn('[AudioResolver] Hybrid search error:', err);
  }

  return null;
}

/**
 * Finds a related song for Autoplay mode when the queue finishes
 */
export async function findRelatedTrack(
  lastTrack: Track,
  recentIds: Set<string>
): Promise<Track | null> {
  try {
    const query = `${lastTrack.author} official audio`;
    const ytResults = await ytSearch(query).catch(() => null);
    const candidates: any[] = ytResults?.videos || [];

    for (const vid of candidates.slice(0, 8)) {
      if (
        vid.videoId &&
        vid.videoId !== lastTrack.id &&
        !recentIds.has(vid.videoId) &&
        vid.title.toLowerCase() !== lastTrack.title.toLowerCase()
      ) {
        const resolved = await searchAndResolveTrack(
          `${vid.title} ${vid.author?.name || ''}`,
          'Autoplay 🔄'
        );
        if (resolved) return resolved;
      }
    }
  } catch {}
  return null;
}

/**
 * Fetches song lyrics via LRCLIB open API
 */
export async function fetchSongLyrics(
  rawQuery: string
): Promise<{ title: string; artist: string; lyrics: string } | null> {
  const clean = rawQuery
    .replace(
      /\(official.*?\)|\[official.*?\]|official music video|official video|official audio|mv|lyrics|lyric video|-/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();

  try {
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(clean)}`);
    if (!res.ok) return null;
    const list = (await res.json()) as any[];
    if (!Array.isArray(list) || list.length === 0) return null;

    const best = list.find((item) => item.plainLyrics) || list[0];
    if (!best?.plainLyrics) return null;

    return {
      title: best.trackName || rawQuery,
      artist: best.artistName || 'Unknown Artist',
      lyrics: best.plainLyrics,
    };
  } catch {
    return null;
  }
}
