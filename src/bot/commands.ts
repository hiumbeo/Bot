import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type CommandInteraction,
  type Message,
  type TextChannel,
  type VoiceBasedChannel,
} from 'discord.js';
import { musicManager } from './musicPlayer.js';
import {
  searchAndResolveTrack,
  fetchSongLyrics,
  getResolverCacheStats,
} from './audioResolver.js';
import { securityManager } from './security.js';
import {
  FILTER_LABELS,
  ANIME_GIF_POOL,
  getNextAnimeGif,
  normalizeGifUrl,
  fetchWebAnimeGifByKeyword,
} from './embeds.js';
import type { AudioFilterMode } from './types.js';

export type HelpCategory = 'overview' | '1' | '2' | '3' | '4' | 'all';

function parseSeekInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((n) => parseInt(n, 10));
    if (parts.some((n) => isNaN(n))) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const sec = parseInt(trimmed, 10);
  return isNaN(sec) ? null : sec;
}

export const slashCommandDefinitions = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Phát nhạc từ YouTube, Spotify hoặc SoundCloud (chống rè SoX 28-bit)')
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Tên bài hát, ca sĩ hoặc link nhạc').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Chỉnh chế độ lọc âm thanh (8 chế độ DSP EQ chống rè)')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Chọn chế độ âm thanh')
        .setRequired(true)
        .addChoices(
          { name: '✨ Crystal Clear (Mặc định - Chống rè SoX 28-bit)', value: 'clear' },
          { name: '🔊 Bass Boost (Tăng âm trầm)', value: 'bassboost' },
          { name: '⚡ Nightcore (Tăng tốc & cao độ)', value: 'nightcore' },
          { name: '☕ Lo-Fi Warm (Âm ấm thư giãn)', value: 'lofi' },
          { name: '🎧 8D Surround (Âm thanh vòm xoay quanh đầu)', value: '8d' },
          { name: '🌊 Vaporwave Slowed + Reverb', value: 'vaporwave' },
          { name: '🎤 Karaoke Vocal Cut (Tách lời hát)', value: 'karaoke' },
          { name: '💎 Treble Vocal Clarity (Tăng độ sáng giọng hát)', value: 'treble' }
        )
    ),
  new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Tua nhanh tới giây hoặc mốc thời gian (VD: 90 hoặc 1:30)')
    .addStringOption((opt) =>
      opt.setName('time').setDescription('Thời gian cần tua tới (VD: 1:30 hoặc 90)').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Xem lời bài hát đang phát hoặc tìm lời bài hát bất kỳ')
    .addStringOption((opt) =>
      opt.setName('song').setDescription('Tên bài hát (để trống để lấy bài đang phát)')
    ),
  new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Bật/tắt chế độ tự động phát nhạc liên quan khi hết hàng chờ'),
  new SlashCommandBuilder()
    .setName('247')
    .setDescription('Bật/tắt chế độ treo Bot 24/7 trong phòng Voice'),
  new SlashCommandBuilder().setName('pause').setDescription('Tạm dừng bài hát đang phát'),
  new SlashCommandBuilder().setName('resume').setDescription('Tiếp tục phát bài hát'),
  new SlashCommandBuilder().setName('skip').setDescription('Bỏ qua bài hát hiện tại'),
  new SlashCommandBuilder().setName('stop').setDescription('Dừng nhạc và xoá hàng chờ'),
  new SlashCommandBuilder().setName('leave').setDescription('Ngắt kết nối bot khỏi kênh thoại'),
  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Chỉnh chế độ lặp: off, track hoặc queue')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Chế độ lặp')
        .setRequired(true)
        .addChoices(
          { name: 'Off (Tắt lặp)', value: 'off' },
          { name: 'Single Track (Lặp 1 bài)', value: 'track' },
          { name: 'Entire Queue (Lặp toàn bộ hàng chờ)', value: 'queue' }
        )
    ),
  new SlashCommandBuilder().setName('queue').setDescription('Xem danh sách hàng chờ nhạc'),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Xoá một bài hát khỏi hàng chờ')
    .addIntegerOption((opt) =>
      opt.setName('index').setDescription('Số thứ tự bài hát trong queue (từ 1)').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Gửi bảng điều khiển nhạc tương tác kèm Anime GIF vào kênh này'),
  new SlashCommandBuilder()
    .setName('gif')
    .setDescription('Lấy GIF Anime theo tên từ Web (VD: anime hi, anime bye) hoặc đổi GIF cho Panel')
    .addStringOption((opt) =>
      opt
        .setName('url')
        .setDescription('Nhập tên GIF (VD: anime hi, anime bye, dance) hoặc dán link .gif')
    )
    .addAttachmentOption((opt) =>
      opt.setName('file').setDescription('Hoặc tải file .gif trực tiếp từ máy/điện thoại')
    ),
  // Server Management & Events Commands
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Mở bảng chọn Kênh Welcome (Anime Hi), Goodbye (Anime Bye) & Auto-Role ngay trên Discord')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Tổ chức sự kiện Giveaway quay thưởng tự động kèm nút bấm')
    .addIntegerOption((opt) =>
      opt.setName('minutes').setDescription('Thời gian diễn ra (số phút)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('prize').setDescription('Tên phần thưởng Giveaway').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('winners').setDescription('Số người trúng giải (mặc định 1)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Tạo bảng bình chọn (Poll) kèm biểu tượng cảm xúc')
    .addStringOption((opt) =>
      opt.setName('question').setDescription('Câu hỏi bình chọn').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('options')
        .setDescription('Các lựa chọn ngăn cách bởi dấu | (VD: Có | Không | Tuỳ ý)')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Đặt trạng thái tạm vắng (AFK) — Bot tự báo khi có người tag bạn')
    .addStringOption((opt) => opt.setName('reason').setDescription('Lý do AFK')),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kiểm tra tốc độ mạng, RAM, Cache và trạng thái âm thanh của Bot'),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Xoá nhanh tin nhắn hàng loạt trong kênh hiện tại (1 - 100 tin)')
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('Số lượng tin nhắn cần xoá (1-100)').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Khoá kênh chat hiện tại (cấm thành viên nhắn tin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Mở khoá kênh chat hiện tại')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Đặt chế độ chậm (Slowmode) cho kênh chat hiện tại')
    .addIntegerOption((opt) =>
      opt
        .setName('seconds')
        .setDescription('Số giây chờ giữa 2 tin nhắn (0 để tắt)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Làm mới hoàn toàn kênh chat (nhân bản kênh & xoá toàn bộ lịch sử cũ)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Gửi thông báo Ban Quản Trị dạng Embed vào kênh này')
    .addStringOption((opt) => opt.setName('title').setDescription('Tiêu đề thông báo').setRequired(true))
    .addStringOption((opt) => opt.setName('message').setDescription('Nội dung thông báo').setRequired(true))
    .addBooleanOption((opt) => opt.setName('everyone').setDescription('Tag @everyone?'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Cảnh cáo thành viên (Đủ 3 cảnh cáo tự động Mute 30 phút)')
    .addUserOption((opt) => opt.setName('user').setDescription('Thành viên vi phạm').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Lý do cảnh cáo').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Xem thông tin thống kê chi tiết của Server'),
  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Xem thông tin tài khoản của thành viên')
    .addUserOption((opt) => opt.setName('user').setDescription('Chọn thành viên')),
  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Xem ảnh đại diện HD của thành viên')
    .addUserOption((opt) => opt.setName('user').setDescription('Chọn thành viên')),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Mở bảng chọn danh mục lệnh (1: Music, 2: Lock/Kênh, 3: Bảo mật, 4: Sự kiện & Tiện ích)')
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Chọn nhanh danh mục lệnh')
        .addChoices(
          { name: '🏠 Tổng quan các mục', value: 'overview' },
          { name: '1️⃣ Lệnh Music, Autoplay, Lyrics & 8 EQ', value: '1' },
          { name: '2️⃣ Lệnh Lock & Quản Lý Kênh Chat', value: '2' },
          { name: '3️⃣ Lệnh Ban / Mute / Warn & Anti-Raid', value: '3' },
          { name: '4️⃣ Lệnh Giveaway, Poll, AFK & Tiện Ích', value: '4' },
          { name: '📋 Xem tất cả lệnh', value: 'all' }
        )
    ),
  // Moderation
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban thành viên khỏi server')
    .addUserOption((opt) => opt.setName('user').setDescription('Thành viên').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Lý do ban'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick thành viên khỏi server')
    .addUserOption((opt) => opt.setName('user').setDescription('Thành viên').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Lý do kick'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute / Timeout thành viên')
    .addUserOption((opt) => opt.setName('user').setDescription('Thành viên').setRequired(true))
    .addIntegerOption((opt) => opt.setName('minutes').setDescription('Số phút mute (mặc định 10)'))
    .addStringOption((opt) => opt.setName('reason').setDescription('Lý do mute'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Gỡ Mute cho thành viên')
    .addUserOption((opt) => opt.setName('user').setDescription('Thành viên').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Cấu hình chế độ bảo vệ chống Raid / Lockdown')
    .addStringOption((opt) =>
      opt
        .setName('status')
        .setDescription('Trạng thái')
        .setRequired(true)
        .addChoices(
          { name: 'Enable Anti-Raid (Bật bảo vệ)', value: 'on' },
          { name: 'Disable Anti-Raid (Tắt bảo vệ)', value: 'off' },
          { name: 'Lockdown Server (Tự động kick mọi người mới vào)', value: 'lockdown' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

export function normalizeHelpCategory(raw?: string | null): HelpCategory {
  if (!raw) return 'overview';
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'music' || v === 'nhac') return '1';
  if (v === '2' || v === 'lock' || v === 'channel' || v === 'kenh') return '2';
  if (v === '3' || v === 'mod' || v === 'security' || v === 'ban' || v === 'antiraid') return '3';
  if (v === '4' || v === 'server' || v === 'info' || v === 'giveaway' || v === 'tienich') return '4';
  if (v === 'all' || v === '5' || v === 'full') return 'all';
  return 'overview';
}

export function buildHelpEmbed(category: HelpCategory = 'overview'): EmbedBuilder {
  const gif = getNextAnimeGif();
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setImage(gif)
    .setFooter({
      text: `Anime GIF Pool (${ANIME_GIF_POOL.length} GIFs xoay vòng) • Bấm thanh chọn bên dưới để đổi trang lệnh`,
      iconURL: 'https://cdn-icons-png.flaticon.com/512/5968/5968756.png',
    })
    .setTimestamp();

  if (category === '1') {
    return embed
      .setTitle('1️⃣ DANH MỤC 1: LỆNH MUSIC, AUTOPLAY, LYRICS & 8 EQ')
      .setDescription(
        'Hệ thống âm thanh **SoX 28-bit + 16MB RAM Buffer + Smart Stream Cache** chống rè tuyệt đối. Dùng được cả dấu `.` và `/`:\n'
      )
      .addFields(
        {
          name: '▶️ Phát Nhạc, Tua Nhạc, Autoplay & Treo 24/7',
          value:
            '• `.play <tên bài/link>` hoặc `/play` — Phát nhạc YouTube / Spotify / SoundCloud\n' +
            '• `.autoplay` (`.ap`) — Tự động tìm & phát nhạc liên quan khi hết bài\n' +
            '• `.247` — Bật chế độ treo Bot 24/7 trong phòng Voice\n' +
            '• `.seek <mm:ss hoặc giây>` — Tua nhanh tới đoạn nhạc (VD: `.seek 1:30`)\n' +
            '• `.lyrics [tên bài]` (`.ly`) — Xem lời bài hát đang phát\n' +
            '• `.pause`, `.resume`, `.skip` (`.s`), `.queue` (`.q`), `.remove <số>`, `.loop`, `.leave`',
        },
        {
          name: '🎚️ 8 Bộ Lọc Âm Thanh DSP (EQ) & Panel Anime GIF',
          value:
            '• `.filter <clear | bassboost | nightcore | lofi | 8d | vaporwave | karaoke | treble>`\n' +
            '• Gõ nhanh: `.bass`, `.nightcore`, `.vaporwave`, `.karaoke`, `.8d`\n' +
            '• `.panel` hoặc `/panel` — Gửi bảng điều khiển nhạc kèm nút bấm & Anime GIF\n' +
            '• `.gif` — Đổi sang Anime GIF tiếp theo trong bộ 10 GIF (hoặc `.gif <link>`)',
        }
      );
  }

  if (category === '2') {
    return embed
      .setTitle('2️⃣ DANH MỤC 2: SETUP WELCOME/GOODBYE, LOCK & KÊNH CHAT')
      .setDescription('Các lệnh cài đặt kênh tự động và quản lý kênh chat ngay trên Discord:\n')
      .addFields(
        {
          name: '⚙️ Setup Kênh Welcome (Anime Hi) / Goodbye (Anime Bye) & Auto-Role',
          value:
            '• **`.setup`** hoặc **`/setup`** — Mở bảng chọn **Kênh Welcome**, **Kênh Goodbye**, **Auto-Role** và test thử GIF ngay trên Discord (không cần vào Web)!\n' +
            '• *Welcome tự động lấy GIF `anime hi` từ Web & Goodbye lấy GIF `anime bye` gửi trần (không nhốt trong khung Embed).*',
        },
        {
          name: '🔒 Khoá Kênh, Dọn Tin Nhắn & Làm Mới Kênh (Nuke)',
          value:
            '• `.lock` / `.unlock` — Khoá hoặc mở khoá kênh chat hiện tại\n' +
            '• `.slowmode <số_giây>` (`.slow`) — Đặt chế độ chờ giữa 2 tin nhắn (`0` để tắt)\n' +
            '• `.clear <1-100>` (`.purge`) — Xoá nhanh từ 1 đến 100 tin nhắn\n' +
            '• `.nuke` hoặc `/nuke` — Làm mới kênh 100% (xoá toàn bộ lịch sử cũ)',
        }
      );
  }

  if (category === '3') {
    return embed
      .setTitle('3️⃣ DANH MỤC 3: LỆNH KIỂM DUYỆT & CHỐNG RAID (SECURITY)')
      .setDescription('Hệ thống bảo vệ Server tự động và xử phạt thành viên vi phạm:\n')
      .addFields(
        {
          name: '⚠️ Cảnh Cáo Tự Động (3 Warn = Tự Động Mute 30 Phút)',
          value:
            '• `.warn @user <lý do>` hoặc `/warn` — Cảnh cáo thành viên\n' +
            '• `.warnings [@user]` (`.warns`) — Xem danh sách lịch sử cảnh cáo\n' +
            '• `.clearwarns [@user]` — Xoá sạch lịch sử cảnh cáo',
        },
        {
          name: '🔨 Mute, Kick, Ban & Chống Raid',
          value:
            '• `.mute @user [phút] [lý do]` — Mute / Timeout thành viên (Mặc định 10p)\n' +
            '• `.unmute @user` — Gỡ Mute cho thành viên\n' +
            '• `.kick @user [lý do]` — Kick thành viên khỏi Server\n' +
            '• `.ban @user [lý do]` — Ban vĩnh viễn thành viên\n' +
            '• `.antiraid <on | off | lockdown>` — Bật chống Raid hoặc **Phong toả Server (Lockdown)**\n' +
            '• *Tự động xoá link mời Discord lạ (`discord.gg/...`) và tự động Mute kẻ spam tag.*',
        }
      );
  }

  if (category === '4') {
    return embed
      .setTitle('4️⃣ DANH MỤC 4: GIVEAWAY, POLL, AFK & TIỆN ÍCH SERVER')
      .setDescription('Các lệnh tổ chức sự kiện tương tác, thông báo và tiện ích thành viên:\n')
      .addFields(
        {
          name: '🎁 Sự Kiện Giveaway, Bình Chọn (Poll) & Thông Báo',
          value:
            '• `.giveaway <phút> <phần thưởng>` (`.ga`) — Tạo Giveaway tự động kèm nút bấm tham gia\n' +
            '• `.poll <Câu hỏi> | <Lựa chọn 1> | <Lựa chọn 2>` — Tạo bình chọn tự thả cảm xúc\n' +
            '• `.announce <Tiêu đề> | <Nội dung>` (`.thongbao`) — Gửi thông báo Embed kèm Anime GIF',
        },
        {
          name: '💤 Trạng Thái AFK & Tra Cứu Hệ Thống',
          value:
            '• `.afk [lý do]` — Bật trạng thái tạm vắng (Bot tự báo khi có người tag bạn)\n' +
            '• `.ping` — Xem tốc độ mạng, RAM, Cache Hit & trạng thái Audio Engine\n' +
            '• `.serverinfo` (`.svinfo`), `.userinfo [@user]` (`.whois`), `.avatar [@user]` (`.av`)',
        }
      );
  }

  if (category === 'all') {
    return embed
      .setTitle('📋 TẤT CẢ LỆNH HỆ THỐNG (FULL COMMAND LIST)')
      .setDescription('Hỗ trợ cả lệnh dấu chấm (`.`) và lệnh Slash (`/`).')
      .addFields(
        {
          name: '1️⃣ Lệnh Music, Autoplay, Lyrics & 8 EQ',
          value:
            '`.play`, `.autoplay`, `.247`, `.seek`, `.lyrics`, `.pause`, `.resume`, `.skip`, `.loop`, `.queue`, `.remove`, `.leave`, `.filter`, `.bass`, `.nightcore`, `.vaporwave`, `.karaoke`, `.panel`, `.gif`',
        },
        {
          name: '2️⃣ Lệnh Lock & Quản Lý Kênh',
          value: '`.lock`, `.unlock`, `.clear <1-100>`, `.slowmode <giây>`, `.nuke`',
        },
        {
          name: '3️⃣ Lệnh Kiểm Duyệt & Anti-Raid',
          value:
            '`.warn`, `.warnings`, `.clearwarns`, `.mute`, `.unmute`, `.kick`, `.ban`, `.antiraid <on|off|lockdown>`',
        },
        {
          name: '4️⃣ Lệnh Giveaway, Poll, AFK & Tiện Ích',
          value:
            '`.giveaway <phút> <quà>`, `.poll <câu hỏi> | <opt1> | <opt2>`, `.announce`, `.afk [lý do]`, `.ping`, `.serverinfo`, `.userinfo`, `.avatar`',
        }
      );
  }

  // Default: 'overview' — Clean numbered summary
  return embed
    .setTitle('📚 BẢNG ĐIỀU KHIỂN LỆNH — CHỌN DANH MỤC')
    .setDescription(
      'Chào bạn! Hãy **bấm vào menu chọn bên dưới** hoặc gõ lệnh theo số thứ tự để xem chi tiết từng nhóm lệnh:\n\n' +
        '> **1️⃣ Lệnh Music, Autoplay, Lyrics & 8 EQ** — `.help 1`\n' +
        '> Phát nhạc, Autoplay, Treo 24/7, Tua nhạc (`.seek`), Lời bài hát (`.lyrics`), 8 EQ & Anime GIF\n\n' +
        '> **2️⃣ Lệnh Setup Welcome/Goodbye, Lock & Kênh** — `.help 2`\n' +
        '> **`.setup`** (Chọn kênh Welcome/Goodbye/Role ngay trên Discord), `.lock`, `.unlock`, `.clear`, `.nuke`\n\n' +
        '> **3️⃣ Lệnh Kiểm Duyệt & Anti-Raid** — `.help 3`\n' +
        '> Cảnh cáo (`.warn`), `.mute`, `.kick`, `.ban`, `.antiraid` & chống link mời lạ\n\n' +
        '> **4️⃣ Lệnh Giveaway, Poll, AFK & Tiện Ích** — `.help 4`\n' +
        '> Quay thưởng (`.giveaway`), Bình chọn (`.poll`), `.afk`, `.announce`, `.ping`, `.serverinfo`'
    );
}

export function buildHelpComponents(
  selectedCategory: HelpCategory = 'overview'
): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const select = new StringSelectMenuBuilder()
    .setCustomId('help_category_select')
    .setPlaceholder('🔽 Bấm vào đây để chọn danh mục lệnh (1, 2, 3, 4)...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🏠 Tổng Quan Bảng Lệnh')
        .setDescription('Xem tóm tắt 4 nhóm lệnh chính của Bot')
        .setValue('overview')
        .setDefault(selectedCategory === 'overview'),
      new StringSelectMenuOptionBuilder()
        .setLabel('1: Lệnh Music, Autoplay, Lyrics & 8 EQ')
        .setDescription('Phát nhạc, Autoplay, 24/7, .seek, .lyrics, 8 chế độ EQ & GIF')
        .setValue('1')
        .setEmoji('🎵')
        .setDefault(selectedCategory === '1'),
      new StringSelectMenuOptionBuilder()
        .setLabel('2: Lệnh Lock & Quản Lý Kênh Chat')
        .setDescription('Khoá kênh (.lock), mở kênh (.unlock), xoá tin (.clear), .nuke')
        .setValue('2')
        .setEmoji('🔒')
        .setDefault(selectedCategory === '2'),
      new StringSelectMenuOptionBuilder()
        .setLabel('3: Lệnh Bảo Mật, Mute, Ban & Anti-Raid')
        .setDescription('Cảnh cáo (.warn), .mute, .kick, .ban, .antiraid & chống link')
        .setValue('3')
        .setEmoji('🛡️')
        .setDefault(selectedCategory === '3'),
      new StringSelectMenuOptionBuilder()
        .setLabel('4: Lệnh Giveaway, Poll, AFK & Tiện Ích')
        .setDescription('Quay thưởng (.giveaway), .poll, .afk, .announce, .ping, .serverinfo')
        .setValue('4')
        .setEmoji('🎁')
        .setDefault(selectedCategory === '4'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📋 Xem Tất Cả Lệnh Cùng Lúc')
        .setDescription('Hiển thị toàn bộ danh sách lệnh trên 1 trang')
        .setValue('all')
        .setDefault(selectedCategory === 'all')
    );

  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)];
}

export function buildServerInfoEmbed(guild: any): EmbedBuilder {
  const cfg = securityManager.getConfig(guild.id);
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🏰 Thông Tin Server: ${guild.name}`)
    .setThumbnail(
      guild.iconURL({ size: 256 }) || 'https://cdn-icons-png.flaticon.com/512/5968/5968756.png'
    )
    .addFields(
      { name: '👑 Chủ Server', value: `<@${guild.ownerId}>`, inline: true },
      { name: '👥 Thành viên', value: `**${guild.memberCount}** người`, inline: true },
      {
        name: '💎 Cấp Boost',
        value: `Level ${guild.premiumTier || 0} (${guild.premiumSubscriptionCount || 0} boosts)`,
        inline: true,
      },
      { name: '💬 Số Kênh', value: `${guild.channels.cache.size} kênh`, inline: true },
      { name: '🎭 Số Role', value: `${guild.roles.cache.size} roles`, inline: true },
      {
        name: '🛡️ Bảo vệ Anti-Raid',
        value: cfg.lockdown ? '🚨 LOCKDOWN' : cfg.enabled ? '✅ Đang Bật' : '⚠️ Đang Tắt',
        inline: true,
      },
      {
        name: '📅 Ngày thành lập',
        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
        inline: false,
      }
    )
    .setImage(getNextAnimeGif())
    .setTimestamp();
}

export function buildPingEmbed(wsPing: number): EmbedBuilder {
  const mem = process.memoryUsage();
  const ramMb = Math.round(mem.rss / 1024 / 1024);
  const heapMb = Math.round(mem.heapUsed / 1024 / 1024);
  const cacheStats = getResolverCacheStats();

  return new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle('⚡ Trạng Thái Tối Ưu Hoá Hệ Thống (System & Audio Engine)')
    .addFields(
      { name: '📡 Độ trễ Discord WS', value: `**${wsPing}ms**`, inline: true },
      { name: '🧠 Bộ nhớ RAM', value: `**${ramMb} MB** (Heap: ${heapMb} MB)`, inline: true },
      { name: '🎚️ DSP Audio Engine', value: '**SoX 28-bit + 16MB Buffer**', inline: true },
      {
        name: '🚀 Tốc độ Cache (0ms)',
        value: `Search Cache: **${cacheStats.searchCacheSize}** bài | Stream Cache: **${cacheStats.streamCacheSize}** luồng | Hits: **${cacheStats.cacheHits}**`,
        inline: false,
      }
    )
    .setImage(getNextAnimeGif())
    .setTimestamp();
}

export async function clearAndRegisterSlashCommands(
  token: string,
  clientId: string,
  guildId?: string
): Promise<{ deletedCount: number; registeredCount: number }> {
  const rest = new REST({ version: '10' }).setToken(token);
  console.log(`[Commands] Purging old slash commands for Client: ${clientId}...`);

  let deletedCount = 0;

  try {
    const existingGlobals = (await rest.get(Routes.applicationCommands(clientId))) as any[];
    deletedCount += existingGlobals?.length || 0;
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
  } catch (err) {
    console.warn('[Commands] Notice while clearing global commands:', err);
  }

  if (guildId) {
    try {
      const existingGuild = (await rest.get(
        Routes.applicationGuildCommands(clientId, guildId)
      )) as any[];
      deletedCount += existingGuild?.length || 0;
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
    } catch (err) {
      console.warn('[Commands] Notice while clearing guild commands:', err);
    }
  }

  const body = slashCommandDefinitions.map((cmd) => cmd.toJSON());
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
  }

  return { deletedCount, registeredCount: body.length };
}

export async function handleSlashCommand(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guildId } = interaction;
  if (!guildId || !interaction.guild) {
    await interaction.reply({ content: 'Chỉ có thể dùng lệnh trong Server.', ephemeral: true });
    return;
  }

  const member = interaction.member as any;
  const voiceChannel = member?.voice?.channel as VoiceBasedChannel | null;
  const textChannel = interaction.channel as TextChannel;

  if (commandName === 'help') {
    const cat = normalizeHelpCategory(interaction.options.getString('category'));
    await interaction.reply({
      embeds: [buildHelpEmbed(cat)],
      components: buildHelpComponents(cat),
    });
    return;
  }

  if (commandName === 'setup') {
    await interaction.reply({
      embeds: [securityManager.buildSetupEmbed(interaction.guild)],
      components: securityManager.buildSetupComponents(guildId),
    });
    return;
  }

  if (commandName === 'ping') {
    await interaction.reply({
      embeds: [buildPingEmbed(interaction.client.ws.ping)],
    });
    return;
  }

  if (commandName === 'afk') {
    const reason = interaction.options.getString('reason') || 'Đang bận (AFK)';
    securityManager.setAfk(guildId, interaction.user.id, reason);
    await interaction.reply({
      content: `💤 <@${interaction.user.id}> đã bật trạng thái **AFK**: *${reason}*`,
    });
    return;
  }

  if (commandName === 'play') {
    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ Bạn phải vào phòng Voice Channel trước khi bật nhạc!',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    const query = interaction.options.getString('query', true);
    const track = await searchAndResolveTrack(query, interaction.user.tag);

    if (!track) {
      await interaction.editReply('❌ Không tìm thấy bài hát phù hợp với từ khoá này.');
      return;
    }

    await musicManager.enqueue(guildId, track, voiceChannel, textChannel);
    await interaction.editReply(
      `🎶 Đã nạp bài hát: **[${track.title}](<${track.url}>)** (\`${track.duration}\`)`
    );
    await musicManager.sendOrAttachPanel(guildId, textChannel);
    return;
  }

  if (commandName === 'filter') {
    const mode = interaction.options.getString('mode', true) as AudioFilterMode;
    musicManager.setFilter(guildId, mode);
    await interaction.reply({
      content: `🎚️ Đã chuyển bộ lọc âm thanh (EQ) sang: **${FILTER_LABELS[mode]}**`,
    });
    return;
  }

  if (commandName === 'seek') {
    const rawTime = interaction.options.getString('time', true);
    const sec = parseSeekInput(rawTime);
    if (sec === null) {
      await interaction.reply({
        content: '❌ Định dạng thời gian không hợp lệ (VD: `1:30` hoặc `90`).',
        ephemeral: true,
      });
      return;
    }
    const ok = musicManager.seek(guildId, sec);
    await interaction.reply({
      content: ok
        ? `⏩ Đã tua bài hát tới mốc **${rawTime}**!`
        : '❌ Hiện không có bài hát nào đang phát.',
    });
    return;
  }

  if (commandName === 'lyrics') {
    const gp = musicManager.getPlayer(guildId);
    const query =
      interaction.options.getString('song') ||
      (gp.currentTrack ? `${gp.currentTrack.title} ${gp.currentTrack.author}` : '');
    if (!query) {
      await interaction.reply({
        content: '❌ Chưa có bài nào đang phát. Hãy nhập tên bài hát!',
        ephemeral: true,
      });
      return;
    }
    await interaction.deferReply();
    const res = await fetchSongLyrics(query);
    if (!res) {
      await interaction.editReply(`❌ Không tìm thấy lời bài hát cho **${query}**.`);
      return;
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎤 Lời bài hát: ${res.title} — ${res.artist}`)
      .setDescription(res.lyrics.slice(0, 3900))
      .setImage(getNextAnimeGif())
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (commandName === 'autoplay') {
    const state = musicManager.toggleAutoplay(guildId);
    await interaction.reply({
      content: state
        ? '♾️ Đã **BẬT Autoplay**! Bot sẽ tự động tìm và phát nhạc liên quan khi hết bài.'
        : '⏹️ Đã **TẮT Autoplay**.',
    });
    return;
  }

  if (commandName === '247') {
    if (voiceChannel) {
      await musicManager.connectToVoice(voiceChannel, textChannel);
    }
    const state = musicManager.toggle247(guildId);
    await interaction.reply({
      content: state
        ? '🌙 Đã **BẬT chế độ 24/7**! Bot sẽ treo cố định trong kênh thoại.'
        : '☀️ Đã **TẮT chế độ 24/7**.',
    });
    return;
  }

  if (commandName === 'gif') {
    const fileAttachment = interaction.options.getAttachment('file');
    const urlInput = interaction.options.getString('url');
    const rawTarget = fileAttachment?.url || urlInput;

    await interaction.deferReply();
    let targetGif = '';
    if (!rawTarget) {
      targetGif = await fetchWebAnimeGifByKeyword('anime music dance');
    } else if (rawTarget.startsWith('http')) {
      targetGif = normalizeGifUrl(rawTarget);
    } else {
      // Keyword search on Web GIF API (e.g. "anime hi", "anime bye", "wave")
      targetGif = await fetchWebAnimeGifByKeyword(rawTarget);
      await interaction.editReply({
        content: `🎬 **GIF Anime theo từ khoá \`${rawTarget}\`:**\n${targetGif}`,
      });
      return;
    }

    musicManager.setCustomBanner(guildId, targetGif);
    await musicManager.sendOrAttachPanel(guildId, textChannel, targetGif);
    await interaction.editReply(
      rawTarget
        ? '✅ Đã cập nhật ảnh GIF cho Music Panel!'
        : '🔄 Đã lấy Anime GIF mới từ Web cho Music Panel!'
    );
    return;
  }

  if (commandName === 'pause') {
    const isPlaying = musicManager.togglePlay(guildId);
    await interaction.reply({
      content: isPlaying ? '▶️ Đã tiếp tục phát nhạc.' : '⏸️ Đã tạm dừng nhạc.',
    });
    return;
  }

  if (commandName === 'resume') {
    const gp = musicManager.getPlayer(guildId);
    if (!gp.isPlaying) {
      musicManager.togglePlay(guildId);
      await interaction.reply({ content: '▶️ Đã tiếp tục phát nhạc.' });
    } else {
      await interaction.reply({ content: 'Nhạc đang phát rồi.', ephemeral: true });
    }
    return;
  }

  if (commandName === 'skip') {
    const skipped = musicManager.skip(guildId);
    await interaction.reply({
      content: skipped ? `⏭️ Đã qua bài: **${skipped.title}**` : 'Không có bài nào đang phát.',
    });
    return;
  }

  if (commandName === 'stop' || commandName === 'leave') {
    musicManager.leave(guildId);
    await interaction.reply({ content: '⏹️ Đã dừng nhạc và rời khỏi kênh thoại.' });
    return;
  }

  if (commandName === 'loop') {
    const mode = interaction.options.getString('mode', true) as any;
    musicManager.setLoopMode(guildId, mode);
    await interaction.reply({ content: `🔁 Chế độ lặp (Loop): **${mode.toUpperCase()}**` });
    return;
  }

  if (commandName === 'queue') {
    const gp = musicManager.getPlayer(guildId);
    if (gp.queue.length === 0 && !gp.currentTrack) {
      await interaction.reply({ content: 'Hàng chờ hiện đang trống.', ephemeral: true });
      return;
    }
    const current = gp.currentTrack
      ? `**Đang phát:** [${gp.currentTrack.title}](<${gp.currentTrack.url}>)\n\n`
      : '';
    const list = gp.queue
      .slice(0, 10)
      .map((t, i) => `\`${i + 1}.\` [${t.title}](<${t.url}>) (\`${t.duration}\`)`)
      .join('\n');
    await interaction.reply({
      content: `📜 **Danh sách hàng chờ**\n${current}${list || '*Chưa có bài tiếp theo.*'}`,
      ephemeral: true,
    });
    return;
  }

  if (commandName === 'remove') {
    const index = interaction.options.getInteger('index', true) - 1;
    const removed = musicManager.remove(guildId, index);
    if (removed) {
      await interaction.reply({ content: `🗑️ Đã xoá bài #${index + 1}: **${removed.title}**` });
    } else {
      await interaction.reply({ content: '❌ Số thứ tự bài không hợp lệ.', ephemeral: true });
    }
    return;
  }

  if (commandName === 'panel') {
    await interaction.deferReply({ ephemeral: true });
    await musicManager.sendOrAttachPanel(guildId, textChannel);
    await interaction.editReply('✅ Đã hiển thị bảng điều khiển Music Panel kèm Anime GIF!');
    return;
  }

  // --- SERVER MANAGEMENT & EVENTS SLASH COMMANDS ---

  if (commandName === 'giveaway') {
    const minutes = interaction.options.getInteger('minutes', true);
    const prize = interaction.options.getString('prize', true);
    const winners = interaction.options.getInteger('winners') || 1;
    await interaction.deferReply({ ephemeral: true });
    try {
      await securityManager.createGiveaway(
        textChannel,
        prize,
        minutes,
        winners,
        interaction.user.tag
      );
      await interaction.editReply(`🎁 Đã tạo sự kiện Giveaway **${prize}** trong ${minutes} phút!`);
    } catch (e: any) {
      await interaction.editReply(`❌ ${e.message}`);
    }
    return;
  }

  if (commandName === 'poll') {
    const question = interaction.options.getString('question', true);
    const rawOpts = interaction.options.getString('options', true);
    const opts = rawOpts.split('|').map((s) => s.trim());
    await interaction.deferReply({ ephemeral: true });
    try {
      await securityManager.sendPoll(textChannel, question, opts, interaction.user.tag);
      await interaction.editReply('📊 Đã đăng bình chọn thành công!');
    } catch (e: any) {
      await interaction.editReply(`❌ ${e.message}`);
    }
    return;
  }

  if (commandName === 'clear') {
    const amount = interaction.options.getInteger('amount', true);
    await interaction.deferReply({ ephemeral: true });
    try {
      const deletedCount = await securityManager.purgeMessages(textChannel, amount);
      await interaction.editReply(`🧹 Đã dọn sạch **${deletedCount}** tin nhắn trong kênh này.`);
    } catch (e: any) {
      await interaction.editReply(`❌ Lỗi xoá tin nhắn: ${e.message}`);
    }
    return;
  }

  if (commandName === 'lock') {
    try {
      const msg = await securityManager.setChannelLock(textChannel, true);
      await interaction.reply({ content: msg });
    } catch (e: any) {
      await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    }
    return;
  }

  if (commandName === 'unlock') {
    try {
      const msg = await securityManager.setChannelLock(textChannel, false);
      await interaction.reply({ content: msg });
    } catch (e: any) {
      await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    }
    return;
  }

  if (commandName === 'slowmode') {
    const seconds = interaction.options.getInteger('seconds', true);
    try {
      const msg = await securityManager.setSlowmode(textChannel, seconds);
      await interaction.reply({ content: msg });
    } catch (e: any) {
      await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    }
    return;
  }

  if (commandName === 'nuke') {
    await interaction.reply({ content: '☢️ Đang làm mới kênh chat...' });
    try {
      await securityManager.nukeChannel(textChannel, interaction.user.tag);
    } catch (e: any) {
      await interaction.followUp({
        content: `❌ Không thể Nuke kênh: ${e.message}`,
        ephemeral: true,
      });
    }
    return;
  }

  if (commandName === 'announce') {
    const title = interaction.options.getString('title', true);
    const content = interaction.options.getString('message', true);
    const everyone = interaction.options.getBoolean('everyone') || false;
    await interaction.deferReply({ ephemeral: true });
    try {
      await securityManager.sendAnnouncement(textChannel, title, content, everyone);
      await interaction.editReply('✅ Đã đăng thông báo thành công!');
    } catch (e: any) {
      await interaction.editReply(`❌ ${e.message}`);
    }
    return;
  }

  if (commandName === 'warn') {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    try {
      const res = await securityManager.warnMember(
        interaction.guild,
        target.id,
        interaction.user.tag,
        reason
      );
      await interaction.reply({
        content:
          `⚠️ Đã cảnh cáo <@${target.id}> (**Lần thứ ${res.totalUserWarnings}/3**)\n` +
          `**Lý do:** ${reason}` +
          (res.autoMuted ? `\n🔇 *Đã tự động Mute 30 phút do chạm mốc 3 lần cảnh cáo!*` : ''),
      });
    } catch (e: any) {
      await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    }
    return;
  }

  if (commandName === 'serverinfo') {
    await interaction.reply({ embeds: [buildServerInfoEmbed(interaction.guild)] });
    return;
  }

  if (commandName === 'userinfo') {
    const user = interaction.options.getUser('user') || interaction.user;
    const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);
    const roles = targetMember
      ? targetMember.roles.cache
          .filter((r) => r.name !== '@everyone')
          .map((r) => `<@&${r.id}>`)
          .slice(0, 10)
          .join(', ') || 'Không có'
      : 'Không rõ';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`👤 Hồ Sơ Thành Viên: ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
        {
          name: '📥 Ngày vào Server',
          value: targetMember?.joinedTimestamp
            ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`
            : 'Không rõ',
          inline: true,
        },
        {
          name: '🎂 Ngày tạo Discord',
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        { name: '🎭 Roles', value: roles, inline: false }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (commandName === 'avatar') {
    const user = interaction.options.getUser('user') || interaction.user;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ Ảnh đại diện của ${user.tag}`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    return;
  }

  // --- MODERATION SLASH COMMANDS ---

  if (commandName === 'ban') {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'Banned via /ban';
    try {
      const msg = await securityManager.banMember(interaction.guild, target.id, reason);
      await interaction.reply({ content: `🛡️ ${msg}` });
    } catch (e: any) {
      await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    }
    return;
  }

  if (commandName === 'kick') {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'Kicked via /kick';
    try {
      const msg = await securityManager.kickMember(interaction.guild, target.id, reason);
      await interaction.reply({ content: `🛡️ ${msg}` });
    } catch (e: any) {
      await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    }
    return;
  }

  if (commandName === 'mute') {
    const target = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes') || 10;
    const reason = interaction.options.getString('reason') || 'Muted via /mute';
    try {
      const msg = await securityManager.muteMember(interaction.guild, target.id, minutes, reason);
      await interaction.reply({ content: `🛡️ ${msg}` });
    } catch (e: any) {
      await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    }
    return;
  }

  if (commandName === 'unmute') {
    const target = interaction.options.getUser('user', true);
    try {
      const msg = await securityManager.unmuteMember(interaction.guild, target.id);
      await interaction.reply({ content: `🛡️ ${msg}` });
    } catch (e: any) {
      await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    }
    return;
  }

  if (commandName === 'antiraid') {
    const status = interaction.options.getString('status', true);
    if (status === 'lockdown') {
      securityManager.updateConfig(guildId, { lockdown: true, enabled: true });
      await interaction.reply({
        content:
          '🚨 **Server đã bật chế độ LOCKDOWN!** Mọi tài khoản mới vào sẽ tự động bị kick.',
      });
    } else if (status === 'on') {
      securityManager.updateConfig(guildId, { enabled: true, lockdown: false });
      await interaction.reply({ content: '🛡️ **Anti-Raid đã được BẬT.**' });
    } else {
      securityManager.updateConfig(guildId, { enabled: false, lockdown: false });
      await interaction.reply({ content: '⚠️ **Anti-Raid đã được TẮT.**' });
    }
    return;
  }
}

export async function handlePrefixCommand(message: Message, prefix = '.') {
  if (!message.guild || message.author.bot || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  if (!command) return;

  const guildId = message.guild.id;
  const voiceChannel = message.member?.voice?.channel;
  const textChannel = message.channel as TextChannel;

  if (command === 'help' || command === 'h' || command === 'menu') {
    const cat = normalizeHelpCategory(args[0]);
    await message.reply({
      embeds: [buildHelpEmbed(cat)],
      components: buildHelpComponents(cat),
    });
    return;
  }

  if (command === 'setup' || command === 'caidat' || command === 'welcome') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await message.reply('❌ Bạn cần quyền `Manage Server` để mở bảng cài đặt kênh & Role.');
      return;
    }
    await message.reply({
      embeds: [securityManager.buildSetupEmbed(message.guild)],
      components: securityManager.buildSetupComponents(guildId),
    });
    return;
  }

  if (command === 'ping') {
    await message.reply({
      embeds: [buildPingEmbed(message.client.ws.ping)],
    });
    return;
  }

  if (command === 'afk') {
    const reason = args.join(' ') || 'Đang bận (AFK)';
    securityManager.setAfk(guildId, message.author.id, reason);
    await message.reply(`💤 <@${message.author.id}> đã bật trạng thái **AFK**: *${reason}*`);
    return;
  }

  if (command === 'play' || command === 'p') {
    if (!voiceChannel) {
      await message.reply('❌ Bạn phải vào kênh thoại (Voice Channel) trước!');
      return;
    }
    const query = args.join(' ');
    if (!query) {
      await message.reply('❌ Vui lòng nhập tên bài hát hoặc link! (Ví dụ: `.play vết thương`)');
      return;
    }

    const track = await searchAndResolveTrack(query, message.author.tag);
    if (!track) {
      await message.reply('❌ Không tìm thấy nguồn nhạc cho bài này.');
      return;
    }

    await musicManager.enqueue(guildId, track, voiceChannel, textChannel);
    await musicManager.sendOrAttachPanel(guildId, textChannel);
    return;
  }

  if (
    command === 'filter' ||
    command === 'eq' ||
    command === 'bass' ||
    command === 'nightcore' ||
    command === 'vaporwave' ||
    command === 'karaoke' ||
    command === '8d'
  ) {
    const presetMap: Record<string, AudioFilterMode> = {
      bass: 'bassboost',
      nightcore: 'nightcore',
      vaporwave: 'vaporwave',
      karaoke: 'karaoke',
      '8d': '8d',
    };
    const arg = (presetMap[command] || args[0]?.toLowerCase()) as AudioFilterMode;
    const valid: AudioFilterMode[] = [
      'clear',
      'bassboost',
      'nightcore',
      'lofi',
      '8d',
      'vaporwave',
      'karaoke',
      'treble',
    ];
    if (arg && valid.includes(arg)) {
      musicManager.setFilter(guildId, arg);
      await message.reply(`🎚️ Đã chỉnh chế độ âm thanh (EQ): **${FILTER_LABELS[arg]}**`);
    } else {
      const next = musicManager.cycleFilter(guildId);
      await message.reply(`🎚️ Đã chuyển EQ sang: **${FILTER_LABELS[next]}**`);
    }
    return;
  }

  if (command === 'seek') {
    if (!args[0]) {
      await message.reply('Cách dùng: `.seek <mm:ss hoặc số_giây>` (VD: `.seek 1:30`)');
      return;
    }
    const sec = parseSeekInput(args[0]);
    if (sec === null) {
      await message.reply('❌ Thời gian không hợp lệ. Ví dụ: `.seek 1:30` hoặc `.seek 90`');
      return;
    }
    const ok = musicManager.seek(guildId, sec);
    await message.reply(
      ok ? `⏩ Đã tua bài hát tới **${args[0]}**!` : '❌ Không có bài nào đang phát.'
    );
    return;
  }

  if (command === 'lyrics' || command === 'ly') {
    const gp = musicManager.getPlayer(guildId);
    const query =
      args.join(' ') ||
      (gp.currentTrack ? `${gp.currentTrack.title} ${gp.currentTrack.author}` : '');
    if (!query) {
      await message.reply('❌ Chưa có bài nào đang phát. Gõ `.lyrics <tên bài>` để tìm lời!');
      return;
    }
    const res = await fetchSongLyrics(query);
    if (!res) {
      await message.reply(`❌ Không tìm thấy lời bài hát cho **${query}**.`);
      return;
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎤 Lời bài hát: ${res.title} — ${res.artist}`)
      .setDescription(res.lyrics.slice(0, 3900))
      .setImage(getNextAnimeGif())
      .setTimestamp();
    await message.reply({ embeds: [embed] });
    return;
  }

  if (command === 'autoplay' || command === 'ap') {
    const state = musicManager.toggleAutoplay(guildId);
    await message.reply(
      state
        ? '♾️ Đã **BẬT Autoplay**! Bot sẽ tự động phát bài tiếp theo liên quan khi hết Queue.'
        : '⏹️ Đã **TẮT Autoplay**.'
    );
    return;
  }

  if (command === '247') {
    if (voiceChannel) {
      await musicManager.connectToVoice(voiceChannel, textChannel);
    }
    const state = musicManager.toggle247(guildId);
    await message.reply(
      state
        ? '🌙 Đã **BẬT chế độ 24/7**! Bot sẽ ở lại kênh thoại liên tục.'
        : '☀️ Đã **TẮT chế độ 24/7**.'
    );
    return;
  }

  if (command === 'gif') {
    const attached = message.attachments.first()?.url;
    const argText = args.join(' ').trim();
    if (attached) {
      musicManager.setCustomBanner(guildId, attached);
      await musicManager.sendOrAttachPanel(guildId, textChannel, attached);
      return;
    }
    if (argText && !argText.startsWith('http')) {
      // Search Web GIF by keyword (e.g. .gif anime hi, .gif anime bye) and send raw borderless GIF!
      const gifUrl = await fetchWebAnimeGifByKeyword(argText);
      await textChannel.send(`${gifUrl}`);
      return;
    }
    const targetGif = argText
      ? normalizeGifUrl(argText)
      : await fetchWebAnimeGifByKeyword('anime music');
    musicManager.setCustomBanner(guildId, targetGif);
    await musicManager.sendOrAttachPanel(guildId, textChannel, targetGif);
    return;
  }

  if (command === 'skip' || command === 's') {
    const skipped = musicManager.skip(guildId);
    await message.reply(
      skipped ? `⏭️ Đã qua bài: **${skipped.title}**` : 'Không có bài nào đang phát.'
    );
    return;
  }

  if (command === 'pause') {
    musicManager.togglePlay(guildId);
    await message.reply('⏸️ Đã tạm dừng nhạc.');
    return;
  }

  if (command === 'resume') {
    musicManager.togglePlay(guildId);
    await message.reply('▶️ Đã tiếp tục phát nhạc.');
    return;
  }

  if (command === 'loop') {
    const mode = args[0]?.toLowerCase();
    if (mode === 'off' || mode === 'track' || mode === 'queue') {
      musicManager.setLoopMode(guildId, mode as any);
      await message.reply(`🔁 Chế độ Loop: **${mode.toUpperCase()}**`);
    } else {
      const nextMode = musicManager.cycleLoop(guildId);
      await message.reply(`🔁 Đã chuyển chế độ Loop sang: **${nextMode.toUpperCase()}**`);
    }
    return;
  }

  if (command === 'leave' || command === 'stop') {
    musicManager.leave(guildId);
    await message.reply('⏹️ Đã dừng nhạc và rời khỏi kênh thoại.');
    return;
  }

  if (command === 'queue' || command === 'q') {
    const gp = musicManager.getPlayer(guildId);
    if (gp.queue.length === 0 && !gp.currentTrack) {
      await message.reply('Hàng chờ hiện đang trống.');
      return;
    }
    const current = gp.currentTrack
      ? `**Đang phát:** [${gp.currentTrack.title}](<${gp.currentTrack.url}>)\n\n`
      : '';
    const list = gp.queue
      .slice(0, 10)
      .map((t, i) => `\`${i + 1}.\` [${t.title}](<${t.url}>) (\`${t.duration}\`)`)
      .join('\n');
    await message.reply(`📜 **Hàng chờ nhạc**\n${current}${list || '*Chưa có bài tiếp theo.*'}`);
    return;
  }

  if (command === 'remove') {
    const index = parseInt(args[0]) - 1;
    if (isNaN(index)) {
      await message.reply('Cách dùng: `.remove <số thứ tự bài trong queue>`');
      return;
    }
    const removed = musicManager.remove(guildId, index);
    if (removed) {
      await message.reply(`🗑️ Đã xoá: **${removed.title}**`);
    } else {
      await message.reply('❌ Số thứ tự không hợp lệ.');
    }
    return;
  }

  if (command === 'panel') {
    await musicManager.sendOrAttachPanel(guildId, textChannel);
    return;
  }

  // --- SERVER MANAGEMENT & EVENTS DOT COMMANDS ---

  if (command === 'giveaway' || command === 'ga') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await message.reply('❌ Bạn cần quyền `Manage Server` để tổ chức Giveaway.');
      return;
    }
    const mins = parseInt(args[0], 10);
    const prize = args.slice(1).join(' ');
    if (isNaN(mins) || !prize) {
      await message.reply('Cách dùng: `.giveaway <số_phút> <phần thưởng>` (VD: `.giveaway 10 Nitro 1 Tháng`)');
      return;
    }
    await securityManager.createGiveaway(textChannel, prize, mins, 1, message.author.tag);
    return;
  }

  if (command === 'poll' || command === 'binhchon') {
    const raw = args.join(' ');
    const parts = raw.split('|').map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) {
      await message.reply(
        'Cách dùng: `.poll Câu hỏi | Lựa chọn 1 | Lựa chọn 2` (VD: `.poll Tối nay chơi game gì? | Valorant | Liên Minh | Nghe nhạc`)'
      );
      return;
    }
    await securityManager.sendPoll(textChannel, parts[0], parts.slice(1), message.author.tag);
    return;
  }

  if (command === 'clear' || command === 'purge') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await message.reply('❌ Bạn cần quyền `Manage Messages` để xoá tin nhắn.');
      return;
    }
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      await message.reply('Cách dùng: `.clear <số tin nhắn từ 1 đến 100>`');
      return;
    }
    try {
      await message.delete().catch(() => {});
      const deletedCount = await securityManager.purgeMessages(textChannel, amount);
      const notify = await textChannel.send(`🧹 Đã dọn sạch **${deletedCount}** tin nhắn.`);
      setTimeout(() => notify.delete().catch(() => {}), 4000);
    } catch (e: any) {
      await message.reply(`❌ Lỗi xoá tin nhắn: ${e.message}`);
    }
    return;
  }

  if (command === 'lock') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply('❌ Bạn cần quyền `Manage Channels` để khoá kênh.');
      return;
    }
    try {
      const msg = await securityManager.setChannelLock(textChannel, true);
      await message.reply(msg);
    } catch (e: any) {
      await message.reply(`❌ ${e.message}`);
    }
    return;
  }

  if (command === 'unlock') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply('❌ Bạn cần quyền `Manage Channels` để mở khoá kênh.');
      return;
    }
    try {
      const msg = await securityManager.setChannelLock(textChannel, false);
      await message.reply(msg);
    } catch (e: any) {
      await message.reply(`❌ ${e.message}`);
    }
    return;
  }

  if (command === 'slowmode' || command === 'slow') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply('❌ Bạn cần quyền `Manage Channels` để chỉnh Slowmode.');
      return;
    }
    const sec = parseInt(args[0]) || 0;
    try {
      const msg = await securityManager.setSlowmode(textChannel, sec);
      await message.reply(msg);
    } catch (e: any) {
      await message.reply(`❌ ${e.message}`);
    }
    return;
  }

  if (command === 'nuke') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.reply('❌ Bạn cần quyền `Manage Channels` để Nuke kênh.');
      return;
    }
    try {
      await securityManager.nukeChannel(textChannel, message.author.tag);
    } catch (e: any) {
      await message.reply(`❌ Không thể Nuke kênh: ${e.message}`);
    }
    return;
  }

  if (command === 'announce' || command === 'thongbao') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await message.reply('❌ Bạn cần quyền `Manage Server` để gửi thông báo.');
      return;
    }
    const raw = args.join(' ');
    if (!raw) {
      await message.reply('Cách dùng: `.announce Tiêu đề | Nội dung thông báo`');
      return;
    }
    const parts = raw.split('|');
    const title = parts.length > 1 ? parts[0].trim() : 'THÔNG BÁO SERVER';
    const content = parts.length > 1 ? parts.slice(1).join('|').trim() : raw;
    await securityManager.sendAnnouncement(textChannel, title, content, false);
    return;
  }

  if (command === 'serverinfo' || command === 'svinfo') {
    await message.reply({ embeds: [buildServerInfoEmbed(message.guild)] });
    return;
  }

  if (command === 'userinfo' || command === 'whois') {
    const user = message.mentions.users.first() || message.author;
    const targetMember = await message.guild.members.fetch(user.id).catch(() => null);
    const roles = targetMember
      ? targetMember.roles.cache
          .filter((r) => r.name !== '@everyone')
          .map((r) => `<@&${r.id}>`)
          .slice(0, 10)
          .join(', ') || 'Không có'
      : 'Không rõ';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`👤 Hồ Sơ Thành Viên: ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
        {
          name: '📥 Ngày vào Server',
          value: targetMember?.joinedTimestamp
            ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`
            : 'Không rõ',
          inline: true,
        },
        {
          name: '🎂 Ngày tạo Discord',
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        { name: '🎭 Roles', value: roles, inline: false }
      )
      .setTimestamp();
    await message.reply({ embeds: [embed] });
    return;
  }

  if (command === 'avatar' || command === 'av') {
    const user = message.mentions.users.first() || message.author;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ Ảnh đại diện của ${user.tag}`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setTimestamp();
    await message.reply({ embeds: [embed] });
    return;
  }

  if (command === 'warn') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await message.reply('❌ Bạn cần quyền `Moderate Members` để cảnh cáo.');
      return;
    }
    const target = message.mentions.members?.first() || args[0];
    if (!target) {
      await message.reply('Cách dùng: `.warn @user <lý do>`');
      return;
    }
    const targetId = typeof target === 'string' ? target : target.id;
    const reason = args.slice(1).join(' ') || 'Vi phạm nội quy server';
    try {
      const res = await securityManager.warnMember(
        message.guild,
        targetId,
        message.author.tag,
        reason
      );
      await message.reply(
        `⚠️ Đã cảnh cáo <@${targetId}> (**Lần thứ ${res.totalUserWarnings}/3**)\n` +
          `**Lý do:** ${reason}` +
          (res.autoMuted ? `\n🔇 *Đã tự động Mute 30 phút do chạm mốc 3 lần cảnh cáo!*` : '')
      );
    } catch (e: any) {
      await message.reply(`❌ ${e.message}`);
    }
    return;
  }

  if (command === 'warnings' || command === 'warns') {
    const target = message.mentions.users.first();
    const list = securityManager.getWarnings(guildId, target?.id);
    if (list.length === 0) {
      await message.reply('✅ Không có lịch sử cảnh cáo nào.');
      return;
    }
    const formatted = list
      .slice(0, 10)
      .map(
        (w, idx) =>
          `\`#${idx + 1}\` **${w.userTag}** — *${w.reason}* (bởi \`${w.moderator}\` lúc ${w.timestamp})`
      )
      .join('\n');
    await message.reply(`📋 **Danh sách cảnh cáo (${list.length})**\n${formatted}`);
    return;
  }

  if (command === 'clearwarns') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await message.reply('❌ Bạn cần quyền `Moderate Members`.');
      return;
    }
    const target = message.mentions.users.first();
    const count = securityManager.clearWarnings(guildId, target?.id);
    await message.reply(`🧹 Đã xoá **${count}** bản ghi cảnh cáo.`);
    return;
  }

  // --- MODERATION DOT COMMANDS ---

  if (command === 'kick') {
    const target = message.mentions.members?.first() || args[0];
    if (!target) {
      await message.reply('Cách dùng: `.kick @user [lý do]`');
      return;
    }
    const targetId = typeof target === 'string' ? target : target.id;
    try {
      const msg = await securityManager.kickMember(
        message.guild,
        targetId,
        args.slice(1).join(' ') || 'Kicked via .kick'
      );
      await message.reply(`🛡️ ${msg}`);
    } catch (e: any) {
      await message.reply(`❌ ${e.message}`);
    }
    return;
  }

  if (command === 'ban') {
    const target = message.mentions.members?.first() || args[0];
    if (!target) {
      await message.reply('Cách dùng: `.ban @user [lý do]`');
      return;
    }
    const targetId = typeof target === 'string' ? target : target.id;
    try {
      const msg = await securityManager.banMember(
        message.guild,
        targetId,
        args.slice(1).join(' ') || 'Banned via .ban'
      );
      await message.reply(`🛡️ ${msg}`);
    } catch (e: any) {
      await message.reply(`❌ ${e.message}`);
    }
    return;
  }

  if (command === 'mute') {
    const target = message.mentions.members?.first() || args[0];
    const minutes = parseInt(args[1]) || 10;
    if (!target) {
      await message.reply('Cách dùng: `.mute @user [số_phút] [lý do]`');
      return;
    }
    const targetId = typeof target === 'string' ? target : target.id;
    try {
      const msg = await securityManager.muteMember(
        message.guild,
        targetId,
        minutes,
        args.slice(2).join(' ') || 'Muted via .mute'
      );
      await message.reply(`🛡️ ${msg}`);
    } catch (e: any) {
      await message.reply(`❌ ${e.message}`);
    }
    return;
  }

  if (command === 'unmute') {
    const target = message.mentions.members?.first() || args[0];
    if (!target) {
      await message.reply('Cách dùng: `.unmute @user`');
      return;
    }
    const targetId = typeof target === 'string' ? target : target.id;
    try {
      const msg = await securityManager.unmuteMember(message.guild, targetId);
      await message.reply(`🛡️ ${msg}`);
    } catch (e: any) {
      await message.reply(`❌ ${e.message}`);
    }
    return;
  }

  if (command === 'antiraid') {
    const sub = args[0]?.toLowerCase();
    if (sub === 'on') {
      securityManager.updateConfig(guildId, { enabled: true, lockdown: false });
      await message.reply('🛡️ Anti-Raid đã được **BẬT**.');
    } else if (sub === 'off') {
      securityManager.updateConfig(guildId, { enabled: false, lockdown: false });
      await message.reply('⚠️ Anti-Raid đã được **TẮT**.');
    } else if (sub === 'lockdown') {
      securityManager.updateConfig(guildId, { lockdown: true, enabled: true });
      await message.reply(
        '🚨 **Server đã bật LOCKDOWN!** Thành viên mới tham gia sẽ tự động bị kick.'
      );
    } else {
      await message.reply('Cách dùng: `.antiraid on | off | lockdown`');
    }
    return;
  }
}
