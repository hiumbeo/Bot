import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from 'discord.js';
import type { Track, LoopMode, AudioFilterMode } from './types.js';
import fs from 'fs';
import path from 'path';

export const LOCAL_BANNER_PATH = path.resolve(process.cwd(), 'public/banner.gif');

/**
 * 10 Base Anime GIFs Pool + Live Web Anime GIF API (OtakuGIFs & Giphy)
 */
export const ANIME_GIF_POOL: string[] = [
  'https://giffiles.alphacoders.com/221/221968.gif',
  'https://giffiles.alphacoders.com/220/220764.gif',
  'https://i.redd.it/1m7v0o2aibxd1.gif',
  'https://giffiles.alphacoders.com/221/221969.gif',
  'https://giffiles.alphacoders.com/220/220765.gif',
  'https://giffiles.alphacoders.com/219/219851.gif',
  'https://giffiles.alphacoders.com/222/222104.gif',
  'https://giffiles.alphacoders.com/218/218942.gif',
  'https://giffiles.alphacoders.com/212/212816.gif',
  'https://giffiles.alphacoders.com/221/221970.gif',
];

let gifRotationIndex = 0;

// Background pre-fetched web anime GIFs queue from api.otakugifs.xyz & Giphy
const liveWebGifQueue: string[] = [];

const OTAKU_MUSIC_REACTIONS = [
  'dance',
  'sing',
  'headbang',
  'happy',
  'cool',
  'celebrate',
  'wave',
  'wink',
  'smile',
  'yay',
  'cheers',
];

const KEYWORD_TO_OTAKU_REACTION: Record<string, string[]> = {
  'anime hi': ['wave', 'happy', 'smile', 'wink', 'yay'],
  hi: ['wave', 'happy', 'smile'],
  hello: ['wave', 'happy', 'smile'],
  welcome: ['wave', 'celebrate', 'happy', 'hug', 'yay'],
  'anime bye': ['wave', 'cry', 'sad', 'pout', 'sigh'],
  bye: ['wave', 'cry', 'sad'],
  goodbye: ['wave', 'cry', 'sad', 'pout'],
  cry: ['cry', 'sad'],
  wave: ['wave'],
  dance: ['dance', 'headbang', 'celebrate'],
  music: ['sing', 'dance', 'headbang', 'cool'],
  hug: ['hug', 'cuddle', 'pat'],
  slap: ['slap', 'smack', 'punch'],
  pat: ['pat', 'hug'],
  kiss: ['kiss', 'airkiss', 'love'],
  cool: ['cool', 'smug', 'wink'],
};

/**
 * Fetches a live Anime GIF from Web APIs (OtakuGIFs + Giphy Search) by keyword
 * e.g., "anime hi", "anime bye", "anime wave", "anime dance"
 */
export async function fetchWebAnimeGifByKeyword(keyword: string): Promise<string> {
  const clean = keyword.trim().toLowerCase();

  // 1. Check if keyword maps to an OtakuGIFs reaction for ultra-clean anime reaction GIFs
  const mappedReactions =
    KEYWORD_TO_OTAKU_REACTION[clean] ||
    (clean.includes('hi') || clean.includes('welcome') || clean.includes('chao')
      ? ['wave', 'happy', 'smile', 'yay']
      : clean.includes('bye') || clean.includes('tam biet') || clean.includes('leave')
      ? ['wave', 'cry', 'sad', 'pout']
      : null);

  // Alternate between OtakuGIFs API and Giphy Search API so there is huge variety
  const useGiphyFirst = Math.random() < 0.45 || !mappedReactions;

  if (!useGiphyFirst && mappedReactions) {
    try {
      const chosenReaction =
        mappedReactions[Math.floor(Math.random() * mappedReactions.length)];
      const res = await fetch(
        `https://api.otakugifs.xyz/gif?reaction=${encodeURIComponent(chosenReaction)}`
      );
      if (res.ok) {
        const data = (await res.json()) as { url?: string };
        if (data.url && data.url.startsWith('http')) {
          return data.url;
        }
      }
    } catch {}
  }

  // 2. Search Giphy Web API by exact keyword (e.g. "anime hi", "anime bye", or custom search)
  try {
    const searchQ = clean.includes('anime') ? clean : `anime ${clean}`;
    const giphyUrl = `https://api.giphy.com/v1/gifs/search?api_key=GlVGYHkr3WSBnllca54iNt0yFbjz7L65&q=${encodeURIComponent(
      searchQ
    )}&limit=15&rating=pg-13`;
    const res = await fetch(giphyUrl);
    if (res.ok) {
      const data = (await res.json()) as { data?: any[] };
      if (data.data && data.data.length > 0) {
        const pick = data.data[Math.floor(Math.random() * data.data.length)];
        const gifUrl =
          pick?.images?.original?.url ||
          pick?.images?.downsized_large?.url ||
          pick?.images?.fixed_height?.url;
        if (gifUrl) return gifUrl;
      }
    }
  } catch {}

  // 3. Fallback to OtakuGIFs if Giphy was tried first
  try {
    const reaction = mappedReactions
      ? mappedReactions[Math.floor(Math.random() * mappedReactions.length)]
      : OTAKU_MUSIC_REACTIONS[Math.floor(Math.random() * OTAKU_MUSIC_REACTIONS.length)];
    const res = await fetch(`https://api.otakugifs.xyz/gif?reaction=${reaction}`);
    if (res.ok) {
      const data = (await res.json()) as { url?: string };
      if (data.url) return data.url;
    }
  } catch {}

  return getNextAnimeGif();
}

/**
 * Refills the background web GIF buffer so synchronous calls to getNextAnimeGif()
 * also mix in fresh web GIFs from OtakuGIFs & Giphy alongside the 10-GIF pool
 */
function refillLiveWebGifQueue() {
  if (liveWebGifQueue.length > 8) return;
  const reaction =
    OTAKU_MUSIC_REACTIONS[Math.floor(Math.random() * OTAKU_MUSIC_REACTIONS.length)];
  fetch(`https://api.otakugifs.xyz/gif?reaction=${reaction}`)
    .then((r) => r.json())
    .then((d: any) => {
      if (d?.url) liveWebGifQueue.push(d.url);
    })
    .catch(() => {});
}

export function getNextAnimeGif(): string {
  refillLiveWebGifQueue();
  // Mix the 10 curated Anime GIFs with live web Anime GIFs
  if (liveWebGifQueue.length > 0 && gifRotationIndex % 2 === 1) {
    const webGif = liveWebGifQueue.shift()!;
    gifRotationIndex++;
    return webGif;
  }
  const gif = ANIME_GIF_POOL[gifRotationIndex % ANIME_GIF_POOL.length];
  gifRotationIndex++;
  return gif;
}

export function getCurrentAnimeGif(): string {
  return ANIME_GIF_POOL[gifRotationIndex % ANIME_GIF_POOL.length];
}

export function normalizeGifUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.includes('reddit.com/media?url=')) {
    try {
      const u = new URL(trimmed);
      const inner = u.searchParams.get('url');
      if (inner) return decodeURIComponent(inner);
    } catch {}
  }
  return trimmed;
}

export const DEFAULT_GIPHY_BANNER = ANIME_GIF_POOL[0];

export const FILTER_LABELS: Record<AudioFilterMode, string> = {
  clear: '✨ Crystal Clear (Chống rè)',
  bassboost: '🔊 Bass Boost',
  nightcore: '⚡ Nightcore',
  lofi: '☕ Lo-Fi Warm',
  '8d': '🎧 8D Surround',
  vaporwave: '🌊 Vaporwave Slowed',
  karaoke: '🎤 Karaoke Vocal Cut',
  treble: '💎 Treble Vocal Clarity',
};

export function createProgressBar(currentSeconds: number, totalSeconds: number, size = 14): string {
  if (totalSeconds <= 0) return '🔘' + '▬'.repeat(size);
  const progress = Math.min(Math.max(currentSeconds / totalSeconds, 0), 1);
  const progressIndex = Math.round(progress * size);
  const line = '▬'.repeat(progressIndex) + '🔘' + '▬'.repeat(Math.max(0, size - progressIndex));
  return line;
}

export function buildMusicEmbed(
  currentTrack: Track | null,
  queue: Track[],
  isPlaying: boolean,
  loopMode: LoopMode,
  volume: number,
  currentSeconds = 0,
  imageUrl?: string,
  _useAttachment = false,
  filterMode: AudioFilterMode = 'clear',
  autoplay = false,
  stay247 = false
): EmbedBuilder {
  const activeGif =
    imageUrl && imageUrl.startsWith('http') ? normalizeGifUrl(imageUrl) : getNextAnimeGif();

  const embed = new EmbedBuilder()
    .setColor(isPlaying ? 0x5865f2 : 0x2b2d31)
    .setImage(activeGif)
    .setFooter({
      text: `Anime Music & Server Station • Gõ .setup để chọn kênh Welcome/Goodbye • .help để xem lệnh`,
      iconURL: 'https://cdn-icons-png.flaticon.com/512/5968/5968756.png',
    })
    .setTimestamp();

  if (!currentTrack) {
    embed
      .setTitle('🎵 Anime Music & Server Station — Ready')
      .setDescription(
        '**Chưa có bài hát nào đang phát.**\n\n' +
          '• Gõ `/play <tên bài>` hoặc `.play <tên bài>` để phát nhạc chất lượng cao.\n' +
          '• Âm thanh **SoX 28-bit + Soft Limiter + 16MB RAM Buffer** chống rè tuyệt đối.\n' +
          '• Gõ **`.setup`** hoặc **`/setup`** để chọn kênh **Welcome (Anime Hi GIF)**, **Goodbye (Anime Bye GIF)** & **Auto-Role** ngay trên Discord.\n' +
          '• Gõ **`.help`** hoặc **`/help`** để mở **Menu Chọn Lệnh (1, 2, 3, 4)**.'
      )
      .addFields(
        { name: '📊 Hàng chờ', value: `${queue.length} bài`, inline: true },
        {
          name: '🔄 Autoplay / 24/7',
          value: `Auto: ${autoplay ? 'ON' : 'OFF'} | 24/7: ${stay247 ? 'ON' : 'OFF'}`,
          inline: true,
        },
        { name: '🎚️ Chế độ âm thanh', value: FILTER_LABELS[filterMode], inline: true }
      );
    return embed;
  }

  const loopLabel =
    loopMode === 'track' ? '🔂 1 Bài' : loopMode === 'queue' ? '🔁 Cả Queue' : '➡️ Tắt';
  const statusIcon = isPlaying ? '▶️ Đang phát' : '⏸️ Tạm dừng';
  const progressLine = createProgressBar(currentSeconds, currentTrack.durationSeconds);
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(secs % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  embed
    .setTitle(`🎶 ${currentTrack.title}`)
    .setURL(currentTrack.url.startsWith('http') ? currentTrack.url : 'https://discord.com')
    .setThumbnail(
      currentTrack.thumbnail || 'https://cdn-icons-png.flaticon.com/512/3844/3844724.png'
    )
    .setDescription(
      `**Nghệ sĩ / Nguồn:** \`${currentTrack.author || 'Music'}\` • **Nền tảng:** \`${currentTrack.platform.toUpperCase()}\`\n` +
        `**Yêu cầu bởi:** \`${currentTrack.requester || 'User'}\` • **EQ:** \`${FILTER_LABELS[filterMode]}\`\n\n` +
        `\`${formatTime(currentSeconds)}\` ${progressLine} \`${currentTrack.duration}\`\n` +
        `**${statusIcon}** | Loop: **${loopLabel}** | Auto: **${autoplay ? 'ON' : 'OFF'}** | 24/7: **${stay247 ? 'ON' : 'OFF'}** | Vol: **${volume}%**`
    )
    .addFields({
      name: `📋 Danh sách phát tiếp theo (${queue.length})`,
      value:
        queue.length > 0
          ? queue
              .slice(0, 4)
              .map(
                (t, idx) =>
                  `**${idx + 1}.** [${t.title.slice(0, 40)}](<${t.url}>) - \`${t.duration}\``
              )
              .join('\n') + (queue.length > 4 ? `\n*+ ${queue.length - 4} bài tiếp theo...*` : '')
          : autoplay
          ? '*Hàng chờ trống — Chế độ Autoplay đang BẬT, bot sẽ tự động tìm bài tiếp theo!*'
          : '*Hàng chờ trống. Nhập `/play` hoặc `.play` để thêm bài.*',
      inline: false,
    });

  return embed;
}

export function buildMusicComponents(
  isPlaying: boolean,
  loopMode: LoopMode,
  filterMode: AudioFilterMode = 'clear',
  autoplay = false
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_toggle_play')
      .setLabel(isPlaying ? 'Pause' : 'Play')
      .setEmoji(isPlaying ? '⏸️' : '▶️')
      .setStyle(isPlaying ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_skip')
      .setLabel('Skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_loop')
      .setLabel(loopMode === 'track' ? 'Loop: 1' : loopMode === 'queue' ? 'Loop: All' : 'Loop: Off')
      .setEmoji(loopMode === 'off' ? '➡️' : loopMode === 'track' ? '🔂' : '🔁')
      .setStyle(loopMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_filter')
      .setLabel(`EQ: ${filterMode.toUpperCase()}`)
      .setEmoji('🎚️')
      .setStyle(filterMode === 'clear' ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_stop_leave')
      .setLabel('Leave')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_autoplay')
      .setLabel(`Auto: ${autoplay ? 'ON' : 'OFF'}`)
      .setEmoji('♾️')
      .setStyle(autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_shuffle')
      .setLabel('Shuffle')
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_vol_down')
      .setLabel('-10%')
      .setEmoji('🔉')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_vol_up')
      .setLabel('+10%')
      .setEmoji('🔊')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_refresh_panel')
      .setLabel('Đổi GIF')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

export function getBannerAttachment(): AttachmentBuilder | null {
  if (fs.existsSync(LOCAL_BANNER_PATH)) {
    return new AttachmentBuilder(LOCAL_BANNER_PATH, { name: 'banner.gif' });
  }
  return null;
}
