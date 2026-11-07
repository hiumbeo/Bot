export type Platform = 'youtube' | 'spotify' | 'soundcloud' | 'direct';
export type LoopMode = 'off' | 'track' | 'queue';
export type AudioFilterMode =
  | 'clear'
  | 'bassboost'
  | 'nightcore'
  | 'lofi'
  | '8d'
  | 'vaporwave'
  | 'karaoke'
  | 'treble';

export interface Track {
  id: string;
  title: string;
  url: string;
  streamUrl?: string;
  streamResolvedAt?: number;
  duration: string; // e.g. "03:45"
  durationSeconds: number;
  thumbnail: string;
  author: string;
  platform: Platform;
  requester: string;
}

export interface WarningRecord {
  id: string;
  userId: string;
  userTag: string;
  moderator: string;
  reason: string;
  timestamp: string;
}

export interface GiveawayItem {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  hostTag: string;
  endsAt: number;
  winnerCount: number;
  participants: string[]; // user IDs
  ended: boolean;
  winnerIds: string[];
}

export interface AfkEntry {
  userId: string;
  reason: string;
  since: number;
}

export interface AntiRaidConfig {
  enabled: boolean;
  joinThreshold: number; // e.g. 5 joins
  timeWindowSeconds: number; // e.g. 10s
  action: 'kick' | 'ban' | 'timeout';
  massMentionThreshold: number; // e.g. 5 mentions
  lockdown: boolean;
  antiInviteLinks: boolean; // Auto-delete discord.gg invite links
  autoRoleId: string; // Optional role ID given on member join
  welcomeChannelId: string; // Optional channel ID for welcome message
  goodbyeChannelId: string; // Optional channel ID for goodbye message
  welcomeGifKeyword: string; // e.g. "anime hi" / "wave"
  goodbyeGifKeyword: string; // e.g. "anime bye" / "cry"
}

export interface BotLog {
  id: string;
  timestamp: string;
  type: 'info' | 'music' | 'security' | 'server' | 'warn' | 'error';
  message: string;
  guild?: string;
}

export interface GuildInfo {
  id: string;
  name: string;
  icon?: string | null;
  memberCount: number;
  boostTier?: number;
  boostCount?: number;
  voiceChannels: { id: string; name: string }[];
  textChannels: { id: string; name: string; slowmode?: number }[];
  roles: { id: string; name: string; color: string }[];
}

export interface SystemMetrics {
  ramMb: number;
  heapMb: number;
  searchCacheSize: number;
  streamCacheSize: number;
  cacheHits: number;
}

export interface BotStatus {
  isOnline: boolean;
  botTag: string | null;
  botId: string | null;
  avatarUrl: string | null;
  ping: number;
  guildsCount: number;
  uptimeSeconds: number;
  guilds: GuildInfo[];
  activeQueuesCount: number;
  metrics?: SystemMetrics;
}
