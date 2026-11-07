import React, { useState, useEffect, useRef } from 'react';
import {
  Disc3,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Repeat1,
  Trash2,
  Volume2,
  VolumeX,
  Shuffle,
  Shield,
  ShieldAlert,
  Terminal,
  Server,
  Radio,
  Send,
  RefreshCw,
  ExternalLink,
  Music2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  UserX,
  Volume1,
  LogOut,
  Sparkles,
  Command,
  Sliders,
  Megaphone,
  Flame,
  Clock,
  Award,
} from 'lucide-react';
import type {
  BotStatus,
  Track,
  LoopMode,
  AudioFilterMode,
  BotLog,
  AntiRaidConfig,
  WarningRecord,
} from './bot/types.js';

const EQ_OPTIONS: { id: AudioFilterMode; label: string; desc: string }[] = [
  { id: 'clear', label: '✨ Crystal Clear', desc: 'SoX 28-bit + Anti-Clip (Chống rè)' },
  { id: 'bassboost', label: '🔊 Bass Boost', desc: 'Tăng âm trầm mạnh mẽ' },
  { id: 'nightcore', label: '⚡ Nightcore', desc: 'Tăng tốc & nâng tone' },
  { id: 'lofi', label: '☕ Lo-Fi Warm', desc: 'Âm ấm áp, chill' },
  { id: '8d', label: '🎧 8D Surround', desc: 'Âm thanh xoay vòm 360°' },
  { id: 'vaporwave', label: '🌊 Vaporwave', desc: 'Slowed + Reverb trầm lắng' },
  { id: 'karaoke', label: '🎤 Karaoke Cut', desc: 'Tách giọng hát chính' },
  { id: 'treble', label: '💎 Treble Clarity', desc: 'Làm sáng lời & nhạc cụ' },
];

const ANIME_GIFS: string[] = [
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

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'music' | 'server' | 'panel' | 'commands' | 'security' | 'logs'
  >('music');

  const [status, setStatus] = useState<BotStatus>({
    isOnline: false,
    botTag: null,
    botId: null,
    avatarUrl: null,
    ping: 0,
    guildsCount: 0,
    uptimeSeconds: 0,
    guilds: [],
    activeQueuesCount: 0,
  });

  // Selected Guild & Channel
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [selectedTextId, setSelectedTextId] = useState<string>('');

  // Bot Connection Form
  const [tokenInput, setTokenInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [commandCleaning, setCommandCleaning] = useState(false);
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Music State
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>('off');
  const [filterMode, setFilterMode] = useState<AudioFilterMode>('clear');
  const [autoplay, setAutoplay] = useState(false);
  const [stay247, setStay247] = useState(false);
  const [volume, setVolume] = useState(100);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchPlatform, setSearchPlatform] = useState<
    'all' | 'youtube' | 'spotify' | 'soundcloud'
  >('all');
  const [customBannerUrl, setCustomBannerUrl] = useState('');
  const [lyricsData, setLyricsData] = useState<{
    title: string;
    artist: string;
    lyrics: string;
  } | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  // Security & Server Management State
  const [antiRaidConfig, setAntiRaidConfig] = useState<AntiRaidConfig>({
    enabled: true,
    joinThreshold: 5,
    timeWindowSeconds: 10,
    action: 'timeout',
    massMentionThreshold: 5,
    lockdown: false,
    antiInviteLinks: true,
    autoRoleId: '',
    welcomeChannelId: '',
    goodbyeChannelId: '',
    welcomeGifKeyword: 'anime hi',
    goodbyeGifKeyword: 'anime bye',
  });
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [targetMemberId, setTargetMemberId] = useState('');
  const [modReason, setModReason] = useState('');
  const [muteDuration, setMuteDuration] = useState(10);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  // Channel, Giveaway, Poll & Announcement Tools State
  const [purgeAmount, setPurgeAmount] = useState(25);
  const [slowmodeSeconds, setSlowmodeSeconds] = useState(0);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceMessage, setAnnounceMessage] = useState('');
  const [announceEveryone, setAnnounceEveryone] = useState(false);
  const [giveawayPrize, setGiveawayPrize] = useState('Nitro Gaming 1 Tháng');
  const [giveawayMinutes, setGiveawayMinutes] = useState(15);
  const [giveawayWinners, setGiveawayWinners] = useState(1);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState('Đồng ý 👍 | Không đồng ý 👎');

  // Logs
  const [logs, setLogs] = useState<BotLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setActionNotice({ type, text });
    setTimeout(() => setActionNotice(null), 5000);
  };

  const currentGuild = status.guilds.find((g) => g.id === selectedGuildId);

  // Poll Bot Status & Logs
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/bot/status');
        if (res.ok) {
          const data: BotStatus = await res.json();
          setStatus(data);
          if (data.guilds.length > 0 && !selectedGuildId) {
            const first = data.guilds[0];
            setSelectedGuildId(first.id);
            if (first.voiceChannels.length > 0) setSelectedVoiceId(first.voiceChannels[0].id);
            if (first.textChannels.length > 0) setSelectedTextId(first.textChannels[0].id);
            if (first.roles && first.roles.length > 0) setSelectedRoleId(first.roles[0].id);
          }
        }
      } catch {}
    };

    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/bot/logs');
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch {}
    };

    fetchStatus();
    fetchLogs();
    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 2500);

    return () => clearInterval(interval);
  }, [selectedGuildId]);

  // Poll Guild Queue & Security
  useEffect(() => {
    if (!selectedGuildId) return;

    const fetchGuildQueue = async () => {
      try {
        const res = await fetch(`/api/bot/queue/${selectedGuildId}`);
        if (res.ok) {
          const data = await res.json();
          setQueue(data.queue || []);
          setCurrentTrack(data.currentTrack || null);
          setIsPlaying(Boolean(data.isPlaying));
          setLoopMode(data.loopMode || 'off');
          setFilterMode(data.filterMode || 'clear');
          setAutoplay(Boolean(data.autoplay));
          setStay247(Boolean(data.stay247));
          setVolume(data.volume ?? 100);
          setPlaybackSeconds(data.playbackSeconds || 0);
        }
      } catch {}
    };

    const fetchSecurity = async () => {
      try {
        const res = await fetch(`/api/bot/security/${selectedGuildId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.config) setAntiRaidConfig(data.config);
          if (data.warnings) setWarnings(data.warnings);
        }
      } catch {}
    };

    fetchGuildQueue();
    fetchSecurity();
    const interval = setInterval(fetchGuildQueue, 1500);
    return () => clearInterval(interval);
  }, [selectedGuildId]);

  const handleGuildChange = (gid: string) => {
    setSelectedGuildId(gid);
    const g = status.guilds.find((item) => item.id === gid);
    if (g) {
      if (g.voiceChannels.length > 0) setSelectedVoiceId(g.voiceChannels[0].id);
      if (g.textChannels.length > 0) setSelectedTextId(g.textChannels[0].id);
      if (g.roles && g.roles.length > 0) setSelectedRoleId(g.roles[0].id);
    }
  };

  const handleStartBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      showNotification('error', 'Vui lòng nhập Discord Bot Token.');
      return;
    }
    setIsConnecting(true);
    try {
      const res = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput, clientId: clientIdInput }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', data.message);
      } else {
        showNotification('error', data.message);
      }
    } catch {
      showNotification('error', 'Không thể kết nối bot.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStopBot = async () => {
    try {
      await fetch('/api/bot/stop', { method: 'POST' });
      showNotification('info', 'Bot đã ngắt kết nối.');
    } catch {}
  };

  const handleClearAndDeployCommands = async () => {
    setCommandCleaning(true);
    try {
      const res = await fetch('/api/bot/clear-commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: selectedGuildId || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', data.message);
      } else {
        showNotification('error', data.message);
      }
    } catch {
      showNotification('error', 'Lỗi khi xoá và cài đặt lại lệnh.');
    } finally {
      setCommandCleaning(false);
    }
  };

  const handleSendPanel = async () => {
    if (!selectedGuildId || !selectedTextId) {
      showNotification('error', 'Vui lòng chọn Server và kênh văn bản trước.');
      return;
    }
    try {
      const res = await fetch('/api/bot/send-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId: selectedGuildId,
          textChannelId: selectedTextId,
          customImageUrl: customBannerUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', data.message);
      } else {
        showNotification('error', data.message);
      }
    } catch {
      showNotification('error', 'Không thể gửi Panel.');
    }
  };

  const handleAddTrack = async (presetQuery?: string) => {
    const q = presetQuery || searchQuery;
    if (!q.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/bot/queue/${selectedGuildId || 'global'}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          voiceChannelId: selectedVoiceId,
          textChannelId: selectedTextId,
          requester: 'Web Dashboard',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', `Đã thêm "${data.track.title}" vào phát!`);
        if (!presetQuery) setSearchQuery('');
      } else {
        showNotification('error', data.message || 'Không tìm thấy bài hát.');
      }
    } catch {
      showNotification('error', 'Lỗi khi thêm bài hát.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleControl = async (action: string, value?: any) => {
    if (!selectedGuildId) return;
    try {
      const res = await fetch(`/api/bot/queue/${selectedGuildId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });
      const data = await res.json();
      if (action === 'filter' && data.filterMode) {
        setFilterMode(data.filterMode);
        showNotification('info', `Đã chuyển bộ lọc âm thanh sang: ${data.filterMode.toUpperCase()}`);
      } else if (action === 'autoplay') {
        setAutoplay(Boolean(data.autoplay));
        showNotification(
          'info',
          data.autoplay ? '♾️ Đã BẬT Autoplay tự phát nhạc liên quan!' : '⏹️ Đã TẮT Autoplay.'
        );
      } else if (action === 'stay247') {
        setStay247(Boolean(data.stay247));
        showNotification(
          'info',
          data.stay247 ? '🌙 Đã BẬT chế độ treo 24/7!' : '☀️ Đã TẮT chế độ 24/7.'
        );
      }
    } catch {}
  };

  const handleFetchLyrics = async () => {
    const q = currentTrack
      ? `${currentTrack.title} ${currentTrack.author}`
      : searchQuery.trim();
    if (!q) {
      showNotification('error', 'Hãy bật 1 bài hát hoặc nhập tên bài vào ô tìm kiếm trước!');
      return;
    }
    setLoadingLyrics(true);
    try {
      const res = await fetch(`/api/bot/lyrics?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) {
        setLyricsData({ title: data.title, artist: data.artist, lyrics: data.lyrics });
      } else {
        showNotification('error', data.message || 'Không tìm thấy lời bài hát.');
      }
    } catch {
      showNotification('error', 'Không thể tải lời bài hát.');
    } finally {
      setLoadingLyrics(false);
    }
  };

  const handleSaveSecurity = async (updates: Partial<AntiRaidConfig>) => {
    if (!selectedGuildId) return;
    try {
      const res = await fetch(`/api/bot/security/${selectedGuildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setAntiRaidConfig(data.config);
        showNotification('success', 'Đã lưu cấu hình Server & Bảo mật!');
      }
    } catch {}
  };

  const handleModAction = async (
    action: 'kick' | 'ban' | 'mute' | 'unmute' | 'warn' | 'clearwarns' | 'addRole' | 'removeRole'
  ) => {
    if (!selectedGuildId) return;
    if (action !== 'clearwarns' && !targetMemberId.trim()) {
      showNotification('error', 'Vui lòng nhập Discord User ID của thành viên.');
      return;
    }
    try {
      const res = await fetch(`/api/bot/security/${selectedGuildId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          targetId: targetMemberId.trim(),
          reason: modReason || 'Thực hiện từ Bảng Điều Khiển Web',
          minutes: muteDuration,
          roleId: selectedRoleId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', data.message);
        if (data.warnings) setWarnings(data.warnings);
        if (action !== 'addRole' && action !== 'removeRole') {
          setModReason('');
        }
      } else {
        showNotification('error', data.message);
      }
    } catch {
      showNotification('error', 'Thao tác thất bại.');
    }
  };

  const handleChannelAction = async (
    action: 'purge' | 'lock' | 'unlock' | 'slowmode' | 'nuke' | 'announce' | 'giveaway' | 'poll',
    customAmount?: number,
    customSec?: number
  ) => {
    if (!selectedGuildId || !selectedTextId) {
      showNotification('error', 'Vui lòng chọn kênh văn bản trước.');
      return;
    }
    try {
      const res = await fetch(`/api/bot/server/${selectedGuildId}/channel-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedTextId,
          action,
          amount: customAmount ?? purgeAmount,
          seconds: customSec ?? slowmodeSeconds,
          title: announceTitle,
          message: announceMessage,
          everyone: announceEveryone,
          prize: giveawayPrize,
          minutes: giveawayMinutes,
          winners: giveawayWinners,
          question: pollQuestion,
          options: pollOptions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', data.message);
        if (action === 'announce') {
          setAnnounceTitle('');
          setAnnounceMessage('');
        } else if (action === 'poll') {
          setPollQuestion('');
        }
      } else {
        showNotification('error', data.message);
      }
    } catch {
      showNotification('error', 'Lỗi khi thực hiện thao tác kênh.');
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  const inviteUrl = status.botId
    ? `https://discord.com/oauth2/authorize?client_id=${status.botId}&permissions=8&scope=bot%20applications.commands`
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center overflow-hidden">
                {status.avatarUrl ? (
                  <img src={status.avatarUrl} alt="Bot Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Disc3 className="w-5 h-5 text-indigo-400 animate-spin" style={{ animationDuration: '6s' }} />
                )}
              </div>
            </div>
            <span
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                status.isOnline ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base lg:text-lg tracking-tight text-white flex items-center gap-2">
                {status.botTag || 'Discord Music & Server Manager'}
              </h1>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  status.isOnline
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {status.isOnline ? 'Online' : 'Offline'}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                SoX 28-bit Anti-Clip
              </span>
            </div>
            <p className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
              <span>
                Ping: <strong className="text-slate-300">{status.ping}ms</strong>
              </span>
              <span>•</span>
              <span>
                RAM: <strong className="text-emerald-400">{status.metrics?.ramMb || 64}MB</strong>
              </span>
              <span>•</span>
              <span>
                Cache Hits: <strong className="text-indigo-400">{status.metrics?.cacheHits || 0}</strong>
              </span>
              <span>•</span>
              <span>
                Lệnh: <code className="bg-slate-800 text-indigo-300 px-1 rounded">.help</code> &{' '}
                <code className="bg-slate-800 text-indigo-300 px-1 rounded">/help</code>
              </span>
            </p>
          </div>
        </div>

        {/* Server Selector */}
        <div className="flex items-center gap-3">
          {status.guilds.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5">
              <Server className="w-4 h-4 text-indigo-400" />
              <select
                value={selectedGuildId}
                onChange={(e) => handleGuildChange(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-200 outline-none cursor-pointer"
              >
                {status.guilds.map((g) => (
                  <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                    {g.name} ({g.memberCount} tv)
                  </option>
                ))}
              </select>
            </div>
          )}

          {inviteUrl && (
            <a
              href={inviteUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition shadow-lg shadow-indigo-600/25"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Mời Bot
            </a>
          )}
        </div>
      </header>

      {/* Notification Banner */}
      {actionNotice && (
        <div
          className={`relative z-20 px-4 py-2.5 text-xs font-medium flex items-center justify-between transition-all ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-200'
              : actionNotice.type === 'error'
              ? 'bg-rose-950/80 border-b border-rose-500/40 text-rose-200'
              : 'bg-indigo-950/80 border-b border-indigo-500/40 text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : actionNotice.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span>{actionNotice.text}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('music')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
              activeTab === 'music'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Music2 className="w-4 h-4" />
            Phát Nhạc & Chống Rè EQ
          </button>

          <button
            onClick={() => setActiveTab('server')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
              activeTab === 'server'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Server className="w-4 h-4" />
            Quản Lý Server & Kênh
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
              activeTab === 'security'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Shield className="w-4 h-4" />
            Anti-Raid & Kiểm Duyệt
          </button>

          <button
            onClick={() => setActiveTab('panel')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
              activeTab === 'panel'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Radio className="w-4 h-4" />
            Discord Panel & GIF
          </button>

          <button
            onClick={() => setActiveTab('commands')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
              activeTab === 'commands'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Command className="w-4 h-4" />
            Token & Xoá Lệnh Cũ
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Live Console ({logs.length})
          </button>
        </div>

        {/* TAB 1: MUSIC PLAYER & ANTI-CRACKLE EQ STUDIO */}
        {activeTab === 'music' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Now Playing */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="relative rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-slate-800/80 p-5 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                    SoX 28-bit Studio Stream
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                      16MB RAM Buffer
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                      {loopMode === 'track' ? '🔂 1 Bài' : loopMode === 'queue' ? '🔁 Queue' : '➡️ Off'}
                    </span>
                  </div>
                </div>

                {/* Artwork */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 mb-4 group shadow-inner">
                  {currentTrack ? (
                    <img
                      src={currentTrack.thumbnail}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
                      <Disc3
                        className="w-12 h-12 mb-2 stroke-1 text-slate-600 animate-spin"
                        style={{ animationDuration: '10s' }}
                      />
                      <p className="text-sm font-medium">Chưa có bài hát nào đang phát</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Nhập tên bài hát bên phải hoặc gõ .play trong Discord
                      </p>
                    </div>
                  )}

                  {isPlaying && currentTrack && (
                    <div className="absolute bottom-3 left-3 flex items-end gap-1 bg-black/70 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10">
                      <span className="w-1 h-3 bg-indigo-400 rounded-full animate-bounce" />
                      <span
                        className="w-1 h-5 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1 h-2 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                      <span
                        className="w-1 h-4 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: '200ms' }}
                      />
                      <span className="text-[11px] font-mono text-indigo-200 ml-1.5">
                        EQ: {filterMode.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Track Info */}
                <div className="mb-4">
                  <h3
                    className="font-bold text-lg text-white truncate"
                    title={currentTrack?.title || 'Chưa chọn bài'}
                  >
                    {currentTrack?.title || 'Chưa Phát Nhạc'}
                  </h3>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {currentTrack?.author || 'Sẵn sàng kết nối'} • Yêu cầu bởi{' '}
                    <span className="text-slate-300 font-medium">
                      {currentTrack?.requester || 'Mọi người'}
                    </span>
                  </p>
                </div>

                {/* Interactive Seek Bar */}
                <div className="space-y-1.5 mb-4">
                  <input
                    type="range"
                    min="0"
                    max={currentTrack?.durationSeconds || 100}
                    value={Math.min(playbackSeconds, currentTrack?.durationSeconds || 100)}
                    disabled={!currentTrack}
                    onChange={(e) => setPlaybackSeconds(parseInt(e.target.value))}
                    onMouseUp={(e) =>
                      handleControl('seek', parseInt((e.target as HTMLInputElement).value))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
                    title="Kéo để tua nhanh bài hát (.seek)"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>{formatSeconds(playbackSeconds)}</span>
                    <span className="text-indigo-400/80 text-[10px]">Kéo thanh để tua (.seek)</span>
                    <span>{currentTrack?.duration || '00:00'}</span>
                  </div>
                </div>

                {/* Autoplay, 24/7 & Lyrics Quick Bar */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <button
                    onClick={() => handleControl('autoplay')}
                    className={`py-1.5 px-2.5 rounded-xl border text-xs font-semibold transition ${
                      autoplay
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    ♾️ Autoplay: {autoplay ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => handleControl('stay247')}
                    className={`py-1.5 px-2.5 rounded-xl border text-xs font-semibold transition ${
                      stay247
                        ? 'bg-indigo-500/25 border-indigo-500/50 text-indigo-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🌙 Treo 24/7: {stay247 ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={handleFetchLyrics}
                    disabled={loadingLyrics}
                    className="py-1.5 px-2.5 rounded-xl border bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25 text-xs font-semibold transition"
                  >
                    {loadingLyrics ? '⏳ Đang tải...' : '🎤 Lời Bài Hát'}
                  </button>
                </div>

                {/* Lyrics Viewer Drawer */}
                {lyricsData && (
                  <div className="mb-4 p-3.5 rounded-xl bg-slate-950/90 border border-indigo-500/40 max-h-48 overflow-y-auto text-xs space-y-1.5">
                    <div className="flex items-center justify-between sticky top-0 bg-slate-950 pb-1.5 border-b border-slate-800">
                      <span className="font-bold text-indigo-300 truncate">
                        🎤 {lyricsData.title} — {lyricsData.artist}
                      </span>
                      <button
                        onClick={() => setLyricsData(null)}
                        className="text-slate-400 hover:text-white text-[11px] px-1.5"
                      >
                        Đóng ✕
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-slate-300 leading-relaxed">
                      {lyricsData.lyrics}
                    </pre>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => handleControl('cycleLoop')}
                    className={`p-2.5 rounded-xl border transition ${
                      loopMode !== 'off'
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                        : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:text-white'
                    }`}
                    title="Chế độ lặp"
                  >
                    {loopMode === 'track' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => handleControl('shuffle')}
                    className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-slate-400 hover:text-white transition"
                    title="Trộn bài"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleControl('togglePlay')}
                    disabled={!currentTrack}
                    className="p-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-xl shadow-indigo-600/30 transition transform active:scale-95"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => handleControl('skip')}
                    disabled={!currentTrack}
                    className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-slate-400 hover:text-white disabled:opacity-50 transition"
                    title="Qua bài"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleControl('leave')}
                    className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 transition"
                    title="Dừng & Rời phòng"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-3 mt-4 px-2 py-1 bg-slate-950/60 rounded-xl border border-slate-800">
                  <button onClick={() => handleControl('volume', volume > 0 ? -100 : 100)}>
                    {volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-slate-500" />
                    ) : volume < 50 ? (
                      <Volume1 className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-indigo-400" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="150"
                    value={volume}
                    onChange={(e) => handleControl('volume', parseInt(e.target.value) - volume)}
                    className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-xs font-mono font-medium text-slate-400 w-8 text-right">
                    {volume}%
                  </span>
                </div>
              </div>

              {/* Audio EQ & Anti-Crackle DSP Selector */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    Bộ Lọc Âm Thanh DSP & Chống Rè (EQ)
                  </h4>
                  <span className="text-[11px] text-emerald-400 font-medium">
                    SoX 28-bit + Soft Limiter
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EQ_OPTIONS.map((eq) => (
                    <button
                      key={eq.id}
                      onClick={() => handleControl('filter', eq.id)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        filterMode === eq.id
                          ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="font-semibold text-xs">{eq.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{eq.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Search & Queue */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                    <Search className="w-4 h-4 text-indigo-400" />
                    Tìm & Phát Nhạc (YouTube, Spotify, SoundCloud)
                  </h4>
                  <div className="flex gap-1">
                    {(['all', 'youtube', 'spotify', 'soundcloud'] as const).map((plat) => (
                      <button
                        key={plat}
                        onClick={() => setSearchPlatform(plat)}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase transition ${
                          searchPlatform === plat
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {plat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nhập tên bài hát, ca sĩ hoặc dán link YouTube / Spotify / SoundCloud..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTrack()}
                    className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    onClick={() => handleAddTrack()}
                    disabled={isSearching || !searchQuery.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition shrink-0"
                  >
                    {isSearching ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    Phát Ngay
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="text-[11px] text-slate-500 self-center mr-1">Gợi ý nhanh:</span>
                  {[
                    'fishy vết thương',
                    'Sơn Tùng M-TP',
                    'Lofi Chill Tiếng Mưa',
                    'V-Pop Remix Nonstop',
                    'Soobin Hoàng Sơn',
                  ].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleAddTrack(preset)}
                      className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700/50 transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Queue List */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex-1 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                  <div className="flex items-center gap-2">
                    <Disc3 className="w-4 h-4 text-indigo-400" />
                    <h4 className="font-semibold text-sm text-slate-200">
                      Hàng Chờ Phát ({queue.length} bài)
                    </h4>
                  </div>
                  {queue.length > 0 && (
                    <button
                      onClick={() => handleControl('clear')}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xoá Hàng Chờ
                    </button>
                  )}
                </div>

                {queue.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                    <Music2 className="w-10 h-10 mb-2 stroke-1 text-slate-600" />
                    <p className="text-sm">Hàng chờ hiện đang trống</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Gõ <code className="text-indigo-400">.play</code> hoặc{' '}
                      <code className="text-indigo-400">/play</code> trong Discord để thêm bài.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
                    {queue.map((track, idx) => (
                      <div
                        key={`${track.id}_${idx}`}
                        className="group flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/60 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono font-semibold text-slate-500 w-5 text-center">
                            #{idx + 1}
                          </span>
                          <img
                            src={track.thumbnail}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover bg-slate-900 border border-slate-800 shrink-0"
                          />
                          <div className="min-w-0">
                            <h5 className="font-medium text-sm text-slate-200 truncate group-hover:text-indigo-300 transition">
                              {track.title}
                            </h5>
                            <p className="text-xs text-slate-400 truncate">
                              {track.author} •{' '}
                              <span className="font-mono text-[11px]">{track.duration}</span> • bởi{' '}
                              {track.requester}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleControl('remove', idx)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition shrink-0"
                          title="Xoá bài này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SERVER MANAGEMENT & CHANNEL TOOLS */}
        {activeTab === 'server' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Channel Control Center */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl">
                <h3 className="font-bold text-base text-white flex items-center gap-2 mb-2">
                  <Server className="w-5 h-5 text-indigo-400" />
                  Quản Lý Kênh Chat (Channel Controls)
                </h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Điều khiển trực tiếp các kênh văn bản trong Server hoặc dùng lệnh{' '}
                  <code className="text-indigo-400">.clear</code>,{' '}
                  <code className="text-indigo-400">.lock</code>,{' '}
                  <code className="text-indigo-400">.unlock</code>,{' '}
                  <code className="text-indigo-400">.slowmode</code>,{' '}
                  <code className="text-indigo-400">.nuke</code> trong Discord.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Chọn Kênh Cần Quản Lý
                    </label>
                    <select
                      value={selectedTextId}
                      onChange={(e) => setSelectedTextId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    >
                      {currentGuild?.textChannels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          #{ch.name} {ch.slowmode ? `(Slowmode: ${ch.slowmode}s)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Lock / Unlock / Nuke Buttons */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      onClick={() => handleChannelAction('lock')}
                      className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Khoá Kênh
                    </button>
                    <button
                      onClick={() => handleChannelAction('unlock')}
                      className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      Mở Khoá
                    </button>
                    <button
                      onClick={() => handleChannelAction('nuke')}
                      className="bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      Nuke Kênh
                    </button>
                  </div>

                  {/* Purge Messages */}
                  <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-indigo-400" />
                        Dọn Dẹp Tin Nhắn Hàng Loạt (.clear)
                      </span>
                      <span className="text-xs font-mono text-indigo-400">{purgeAmount} tin</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {[10, 25, 50, 100].map((num) => (
                        <button
                          key={num}
                          onClick={() => {
                            setPurgeAmount(num);
                            handleChannelAction('purge', num);
                          }}
                          className="flex-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold py-2 rounded-lg transition"
                        >
                          Xoá {num} tin
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Slowmode */}
                  <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        Chế Độ Chậm Chống Spam (.slowmode)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Tắt (0s)', val: 0 },
                        { label: '5 giây', val: 5 },
                        { label: '15 giây', val: 15 },
                        { label: '30 giây', val: 30 },
                        { label: '1 phút', val: 60 },
                        { label: '5 phút', val: 300 },
                      ].map((item) => (
                        <button
                          key={item.val}
                          onClick={() => {
                            setSlowmodeSeconds(item.val);
                            handleChannelAction('slowmode', undefined, item.val);
                          }}
                          className="bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Welcome, Goodbye & Auto-Role Settings */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-400" />
                    Welcome & Goodbye GIF (Ngoài Embed) + Auto-Role
                  </h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    Gõ .setup trong Discord
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Bạn có thể gõ <code className="text-indigo-400 font-bold">.setup</code> hoặc{' '}
                  <code className="text-indigo-400 font-bold">/setup</code> ngay trong Discord để chọn Kênh Welcome, Kênh Goodbye và Role bằng menu thả xuống mà không cần mở Web! GIF lấy trực tiếp từ Web API (<code>anime hi</code> / <code>anime bye</code>) và gửi <strong>ngoài Embed</strong>.
                </p>
                <div className="space-y-4 mt-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      👋 Kênh Chào Mừng (Welcome — GIF &quot;anime hi&quot; Ngoài Embed)
                    </label>
                    <select
                      value={antiRaidConfig.welcomeChannelId || ''}
                      onChange={(e) => handleSaveSecurity({ welcomeChannelId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="">-- Tắt thông báo chào mừng --</option>
                      {currentGuild?.textChannels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          #{ch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      💔 Kênh Tạm Biệt (Goodbye — GIF &quot;anime bye&quot; Ngoài Embed)
                    </label>
                    <select
                      value={antiRaidConfig.goodbyeChannelId || ''}
                      onChange={(e) => handleSaveSecurity({ goodbyeChannelId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="">-- Tắt thông báo tạm biệt --</option>
                      {currentGuild?.textChannels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          #{ch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      🎭 Tự Động Gắn Role Khi Có Thành Viên Mới (Auto-Role)
                    </label>
                    <select
                      value={antiRaidConfig.autoRoleId || ''}
                      onChange={(e) => handleSaveSecurity({ autoRoleId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="">-- Không tự động cấp Role --</option>
                      {currentGuild?.roles?.map((r) => (
                        <option key={r.id} value={r.id}>
                          @{r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Server Announcement & Role Assignment */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              {/* Announcement Builder */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl">
                <h3 className="font-bold text-base text-white flex items-center gap-2 mb-2">
                  <Megaphone className="w-5 h-5 text-indigo-400" />
                  Phát Thông Báo Ban Quản Trị (.announce)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Đăng bảng thông báo dạng Embed chuyên nghiệp kèm GIF vào kênh đã chọn.
                </p>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Tiêu Đề Thông Báo
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Thông Báo Sự Kiện / Nội Quy Server..."
                      value={announceTitle}
                      onChange={(e) => setAnnounceTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Nội Dung Chi Tiết
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Nhập nội dung thông báo..."
                      value={announceMessage}
                      onChange={(e) => setAnnounceMessage(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={announceEveryone}
                        onChange={(e) => setAnnounceEveryone(e.target.checked)}
                        className="rounded accent-indigo-600"
                      />
                      Tag @everyone khi gửi
                    </label>

                    <button
                      onClick={() => handleChannelAction('announce')}
                      disabled={!announceMessage.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Đăng Thông Báo
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Role Assigner */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl">
                <h3 className="font-bold text-base text-white flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  Cấp / Gỡ Role Thành Viên Nhanh
                </h3>
                <div className="space-y-3.5 mt-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Discord User ID Thành Viên
                    </label>
                    <input
                      type="text"
                      placeholder="Nhập ID người dùng..."
                      value={targetMemberId}
                      onChange={(e) => setTargetMemberId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Chọn Role
                    </label>
                    <select
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none"
                    >
                      {currentGuild?.roles?.map((r) => (
                        <option key={r.id} value={r.id}>
                          @{r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => handleModAction('addRole')}
                      className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-semibold py-2.5 rounded-xl text-xs transition"
                    >
                      + Cấp Role Này
                    </button>
                    <button
                      onClick={() => handleModAction('removeRole')}
                      className="bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 font-semibold py-2.5 rounded-xl text-xs transition"
                    >
                      - Gỡ Role Này
                    </button>
                  </div>
                </div>
              </div>

              {/* Giveaway & Poll Event Creator */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl space-y-5">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2 mb-1">
                    <Sparkles className="w-5 h-5 text-pink-400" />
                    Tổ Chức Sự Kiện Giveaway Tự Động (.giveaway)
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Gửi bảng Giveaway kèm Anime GIF và nút bấm tham gia vào kênh đã chọn.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2.5">
                    <input
                      type="text"
                      placeholder="Phần thưởng (VD: Nitro 1 Tháng)"
                      value={giveawayPrize}
                      onChange={(e) => setGiveawayPrize(e.target.value)}
                      className="sm:col-span-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Số phút"
                      value={giveawayMinutes}
                      onChange={(e) => setGiveawayMinutes(parseInt(e.target.value) || 10)}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <button
                    onClick={() => handleChannelAction('giveaway')}
                    className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold py-2.5 rounded-xl text-xs transition shadow-lg shadow-pink-600/20"
                  >
                    🎁 Phát Động Giveaway Ngay ({giveawayMinutes} Phút)
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <h4 className="font-bold text-sm text-white mb-2">
                    📊 Tạo Bảng Bình Chọn Server (.poll)
                  </h4>
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      placeholder="Câu hỏi bình chọn (VD: Tối nay chơi game gì?)"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Các lựa chọn cách nhau bởi dấu | (VD: Valorant | Liên Minh | Nghe Nhạc)"
                      value={pollOptions}
                      onChange={(e) => setPollOptions(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                    <button
                      onClick={() => handleChannelAction('poll')}
                      disabled={!pollQuestion.trim()}
                      className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition"
                    >
                      📊 Đăng Bình Chọn Tự Thả Emoji
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ANTI-RAID & MODERATION */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-indigo-400" />
                  Hệ Thống Chống Raid & Chống Rải Link
                </h3>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    antiRaidConfig.enabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {antiRaidConfig.enabled ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>

              <div className="space-y-3.5">
                <div className="flex items-center justify-between p-3.5 bg-slate-950/70 rounded-xl border border-slate-800">
                  <div>
                    <span className="font-semibold text-sm text-slate-200 block">
                      Bảo Vệ Anti-Raid Tự Động
                    </span>
                    <span className="text-xs text-slate-400">
                      Chặn join ồ ạt & tự động Mute kẻ spam tag @everyone
                    </span>
                  </div>
                  <button
                    onClick={() => handleSaveSecurity({ enabled: !antiRaidConfig.enabled })}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                      antiRaidConfig.enabled
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {antiRaidConfig.enabled ? 'Đang Bật' : 'Đang Tắt'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-950/70 rounded-xl border border-slate-800">
                  <div>
                    <span className="font-semibold text-sm text-slate-200 block">
                      Chống Rải Link Discord Lạ (Anti-Invite)
                    </span>
                    <span className="text-xs text-slate-400">
                      Tự động xoá mọi tin nhắn chứa link discord.gg/... của member
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      handleSaveSecurity({ antiInviteLinks: !antiRaidConfig.antiInviteLinks })
                    }
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                      antiRaidConfig.antiInviteLinks
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {antiRaidConfig.antiInviteLinks ? 'Đang Bật' : 'Đang Tắt'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-rose-950/30 rounded-xl border border-rose-500/30">
                  <div>
                    <span className="font-semibold text-sm text-rose-300 block">
                      Chế Độ Phong Toả Server (Lockdown)
                    </span>
                    <span className="text-xs text-rose-400/80">
                      Tự động Kick mọi tài khoản mới gia nhập trong lúc bị tấn công
                    </span>
                  </div>
                  <button
                    onClick={() => handleSaveSecurity({ lockdown: !antiRaidConfig.lockdown })}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                      antiRaidConfig.lockdown
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {antiRaidConfig.lockdown ? 'LOCKDOWN ON' : 'Tắt'}
                  </button>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Giới hạn số người vào cùng lúc trong {antiRaidConfig.timeWindowSeconds}s:{' '}
                    {antiRaidConfig.joinThreshold} người
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    value={antiRaidConfig.joinThreshold}
                    onChange={(e) =>
                      setAntiRaidConfig({
                        ...antiRaidConfig,
                        joinThreshold: parseInt(e.target.value),
                      })
                    }
                    onMouseUp={() =>
                      handleSaveSecurity({ joinThreshold: antiRaidConfig.joinThreshold })
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Hình Phạt Khi Phát Hiện Raid
                  </label>
                  <select
                    value={antiRaidConfig.action}
                    onChange={(e) => handleSaveSecurity({ action: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="timeout">Mute / Timeout 10 Phút</option>
                    <option value="kick">Kick khỏi Server</option>
                    <option value="ban">Ban Vĩnh Viễn</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Moderation & Warning System */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl">
                <h3 className="font-bold text-base text-white flex items-center gap-2 mb-2">
                  <UserX className="w-5 h-5 text-rose-400" />
                  Xử Phạt & Cảnh Cáo Thành Viên (.warn / .mute / .ban)
                </h3>
                <div className="space-y-3.5 mt-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Discord User ID Thành Viên
                    </label>
                    <input
                      type="text"
                      placeholder="Nhập ID thành viên..."
                      value={targetMemberId}
                      onChange={(e) => setTargetMemberId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Lý Do Xử Phạt / Cảnh Cáo
                    </label>
                    <input
                      type="text"
                      placeholder="Lý do vi phạm..."
                      value={modReason}
                      onChange={(e) => setModReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                    <button
                      onClick={() => handleModAction('warn')}
                      className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 font-semibold py-2.5 rounded-xl text-xs transition"
                    >
                      ⚠️ Cảnh Cáo
                    </button>
                    <button
                      onClick={() => handleModAction('mute')}
                      className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-600/30 font-semibold py-2.5 rounded-xl text-xs transition"
                    >
                      🔇 Mute 10p
                    </button>
                    <button
                      onClick={() => handleModAction('unmute')}
                      className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-600/30 font-semibold py-2.5 rounded-xl text-xs transition"
                    >
                      🔊 Gỡ Mute
                    </button>
                    <button
                      onClick={() => handleModAction('kick')}
                      className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/30 font-semibold py-2.5 rounded-xl text-xs transition"
                    >
                      👢 Kick
                    </button>
                    <button
                      onClick={() => handleModAction('ban')}
                      className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/30 font-semibold py-2.5 rounded-xl text-xs transition"
                    >
                      🔨 Ban
                    </button>
                  </div>
                </div>
              </div>

              {/* Warnings Log */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm text-white">
                    📋 Lịch Sử Cảnh Cáo ({warnings.length})
                  </h4>
                  {warnings.length > 0 && (
                    <button
                      onClick={() => handleModAction('clearwarns')}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      Xoá tất cả
                    </button>
                  )}
                </div>
                {warnings.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Chưa có thành viên nào bị cảnh cáo.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {warnings.map((w) => (
                      <div
                        key={w.id}
                        className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex justify-between items-center"
                      >
                        <div>
                          <span className="font-semibold text-amber-300">{w.userTag}</span>:{' '}
                          <span className="text-slate-300">{w.reason}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{w.timestamp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DISCORD PANEL & 10 ANIME GIFS */}
        {activeTab === 'panel' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl">
                <h3 className="font-bold text-base text-white flex items-center gap-2 mb-2">
                  <Send className="w-5 h-5 text-indigo-400" />
                  Gửi Bảng Điều Khiển Music Panel & 10 Anime GIFs
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Bot đã tích hợp sẵn **10 Anime GIFs** tự động lặp đi lặp lại mỗi khi đổi bài, bấm nút <code>🔄 Đổi GIF / Refresh</code> hoặc gõ <code>.gif</code> / <code>.help</code> trong Discord!
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Kênh Văn Bản Nhận Panel
                    </label>
                    <select
                      value={selectedTextId}
                      onChange={(e) => setSelectedTextId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                    >
                      {currentGuild?.textChannels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          #{ch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Link GIF Đang Chọn (Để trống = Tự xoay vòng 10 Anime GIFs)
                      </label>
                      {customBannerUrl && (
                        <button
                          onClick={() => setCustomBannerUrl('')}
                          className="text-[11px] text-indigo-400 hover:underline"
                        >
                          Bật lại xoay vòng 10 GIF
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Tự động xoay vòng 10 Anime GIFs (hoặc bấm chọn 1 GIF bên phải)..."
                      value={customBannerUrl}
                      onChange={(e) => setCustomBannerUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                    />
                  </div>

                  <button
                    onClick={handleSendPanel}
                    disabled={!status.isOnline}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                  >
                    <Send className="w-4 h-4" />
                    Gửi Music Panel Kèm Anime GIF Vào Kênh
                  </button>
                </div>
              </div>

              {/* Help Select Menu Info Card */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
                <h4 className="font-bold text-sm text-white mb-2">
                  📚 Menu Chọn Lệnh (.help / /help)
                </h4>
                <p className="text-xs text-slate-400 mb-3">
                  Gõ <code className="text-indigo-400">.help</code> hoặc <code className="text-indigo-400">/help</code> trong Discord để hiện thanh chọn (Select Menu) chia rõ từng mục:
                </p>
                <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                    1: Lệnh Music & Chống Rè EQ (.help 1)
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                    2: Lệnh Lock & Quản Lý Kênh Chat (.help 2)
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                    3: Lệnh Bảo Mật, Mute, Ban & Anti-Raid (.help 3)
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                    4: Lệnh Thông Báo & Tiện Ích Server (.help 4)
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-5">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Xem Trước Giao Diện Panel Trên Discord
                </span>
                <div className="bg-[#313338] rounded-xl p-4 border border-[#232428] shadow-2xl font-sans text-slate-200">
                  <div className="ml-2 border-l-4 border-[#5865f2] bg-[#2b2d31] rounded-r-lg overflow-hidden shadow-lg">
                    <div className="w-full h-48 overflow-hidden bg-black/40">
                      <img
                        src={customBannerUrl.trim() || ANIME_GIFS[0]}
                        alt="Panel Banner"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h4 className="font-bold text-base text-white mb-1">
                        {currentTrack
                          ? `🎶 ${currentTrack.title}`
                          : '🎵 Anime Music & Server Station — Ready'}
                      </h4>
                      <p className="text-xs text-[#dbdee1] leading-relaxed mb-3">
                        SoX 28-bit Anti-Clip Audio • EQ: <code>{filterMode.toUpperCase()}</code> • 10 Anime GIFs Rotation
                      </p>
                      <div className="pt-3 border-t border-[#383a40] flex flex-wrap gap-2">
                        <span className="bg-[#4e5058] text-white text-xs px-3 py-1.5 rounded">
                          {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                        </span>
                        <span className="bg-[#5865f2] text-white text-xs px-3 py-1.5 rounded">
                          ⏭️ Skip
                        </span>
                        <span className="bg-[#4e5058] text-white text-xs px-3 py-1.5 rounded">
                          🎚️ EQ: {filterMode.toUpperCase()}
                        </span>
                        <span className="bg-[#4e5058] text-white text-xs px-3 py-1.5 rounded">
                          🔄 Đổi GIF / Refresh
                        </span>
                        <span className="bg-[#da373c] text-white text-xs px-3 py-1.5 rounded">
                          ⏹️ Leave
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 10 Anime GIFs Pool Grid */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm text-white">
                    🎬 Bộ 10 Anime GIFs Đang Xoay Vòng Tự Động
                  </h4>
                  <span className="text-[11px] text-indigo-400">
                    Bấm vào ảnh bất kỳ để xem thử
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {ANIME_GIFS.map((gifUrl, idx) => (
                    <button
                      key={gifUrl}
                      onClick={() => setCustomBannerUrl(gifUrl)}
                      className={`group relative aspect-video rounded-xl overflow-hidden border-2 transition ${
                        customBannerUrl === gifUrl
                          ? 'border-indigo-500 ring-2 ring-indigo-500/40'
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <img
                        src={gifUrl}
                        alt={`Anime GIF #${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TOKEN & SLASH COMMANDS CLEANER */}
        {activeTab === 'commands' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl">
              <h3 className="font-bold text-base text-white flex items-center gap-2 mb-2">
                <Lock className="w-5 h-5 text-indigo-400" />
                Kết Nối Token Bot Discord
              </h3>
              <form onSubmit={handleStartBot} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Discord Bot Token
                  </label>
                  <input
                    type="password"
                    placeholder="Dán Bot Token vào đây..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Application / Client ID (Tuỳ chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 123456789012345678"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    {isConnecting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    {status.isOnline ? 'Kết Nối Lại Bot' : 'Khởi Động Bot'}
                  </button>
                  {status.isOnline && (
                    <button
                      type="button"
                      onClick={handleStopBot}
                      className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-semibold px-4 py-2.5 rounded-xl border border-rose-500/30 transition"
                    >
                      Ngắt Kết Nối
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2 mb-2">
                  <RefreshCw className="w-5 h-5 text-indigo-400" />
                  Xoá Sạch Lệnh / Cũ & Cài Bộ Lệnh Mới (28 Lệnh + /setup)
                </h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Xoá toàn bộ các lệnh Slash (<code>/</code>) cũ bị kẹt trên Discord và đăng ký đầy đủ bộ 28 lệnh Nhạc + EQ + Quản lý Server + <code>/setup</code> mới nhất.
                </p>
              </div>
              <button
                onClick={handleClearAndDeployCommands}
                disabled={commandCleaning || !status.isOnline}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
              >
                {commandCleaning ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Xoá Lệnh / Cũ & Cài Đặt Bộ Lệnh Mới
              </button>
            </div>

            {/* GitHub Clone & 24/7 Hosting Guide Card */}
            <div className="lg:col-span-12 bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-6 backdrop-blur-xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-indigo-400" />
                    📦 Chia Sẻ Source Code & Lệnh Git Clone (Dành Cho Mọi Người)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Gửi link GitHub hoặc đoạn lệnh bên dưới cho bạn bè để ai cũng có thể tải về và tự chạy Bot trong 30 giây!
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        'git clone https://github.com/hiumbeo/Bot.git\ncd Bot\nnpm install --legacy-peer-deps\nnpx tsx server.ts'
                      );
                      showNotification('success', '📋 Đã copy bộ lệnh git clone & cài đặt!');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition shadow-lg shadow-indigo-600/20"
                  >
                    📋 Copy Lệnh Git Clone
                  </button>
                  <a
                    href="https://github.com/hiumbeo/Bot"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Mở GitHub (hiumbeo/Bot)
                  </a>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-300 space-y-1 overflow-x-auto">
                <div className="text-slate-500"># 1. Tải source code về máy tính hoặc VPS</div>
                <div>git clone https://github.com/hiumbeo/Bot.git</div>
                <div>cd Bot</div>
                <div className="text-slate-500 pt-1"># 2. Cài đặt thư viện (không bao giờ lỗi ERESOLVE)</div>
                <div>npm install --legacy-peer-deps</div>
                <div className="text-slate-500 pt-1"># 3. Chạy Bot + Web Dashboard tại http://localhost:3000 (hoặc bấm đúp file start.bat trên Windows)</div>
                <div>npx tsx server.ts</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="font-bold text-emerald-400 text-sm">
                    Cách 1: Host Miễn Phí Trên Render.com
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    1. Kết nối repo <code>https://github.com/hiumbeo/Bot</code> vào <strong>Render.com</strong>.<br />
                    2. Build Command: <code>npm install --legacy-peer-deps &amp;&amp; npm run build</code><br />
                    3. Start Command: <code>npx tsx server.ts</code><br />
                    4. Thêm Environment Variable: <code>DISCORD_BOT_TOKEN</code> = Token của bạn.<br />
                    5. Dùng <a href="https://uptimerobot.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline">UptimeRobot.com</a> ping vào <code>/api/bot/status</code> mỗi 5 phút để thức 24/7!
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="font-bold text-indigo-400 text-sm">
                    Cách 2: Chạy Trên Windows (1 Click)
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    1. Cài đặt <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-indigo-400 underline">Node.js 20+</a>.<br />
                    2. Chạy <code>git clone https://github.com/hiumbeo/Bot.git</code> hoặc tải file ZIP trên GitHub về giải nén.<br />
                    3. Bấm đúp vào file <code>start.bat</code> trong thư mục.<br />
                    4. Mở trình duyệt vào <code>http://localhost:3000</code> dán Token là xong!
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="font-bold text-amber-400 text-sm">
                    Cách 3: Treo Trên VPS Linux 24/7 (PM2)
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Copy cụm lệnh này dán thẳng vào Terminal VPS Ubuntu/Debian:<br />
                    <code className="block bg-slate-900 p-2 rounded mt-1 text-emerald-300 font-mono">
                      git clone https://github.com/hiumbeo/Bot.git &amp;&amp; cd Bot<br />
                      npm install --legacy-peer-deps &amp;&amp; npm i -g pm2<br />
                      DISCORD_BOT_TOKEN=&quot;token&quot; pm2 start &quot;npx tsx server.ts&quot; --name bot<br />
                      pm2 save &amp;&amp; pm2 startup
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: LIVE CONSOLE */}
        {activeTab === 'logs' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl flex flex-col font-mono shadow-2xl h-[520px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>Discord Bot Real-Time Console</span>
              </div>
              <span className="text-[11px] text-slate-500">Auto-streaming events</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 text-xs pr-2">
              {logs.map((l) => (
                <div key={l.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 shrink-0">[{l.timestamp}]</span>
                  <span
                    className={`font-semibold shrink-0 uppercase text-[10px] px-1.5 py-0.2 rounded ${
                      l.type === 'music'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800/40'
                        : l.type === 'security'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800/40'
                        : l.type === 'server'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {l.type}
                  </span>
                  {l.guild && <span className="text-indigo-400 shrink-0">[{l.guild}]</span>}
                  <span className="text-slate-300 break-words">{l.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
