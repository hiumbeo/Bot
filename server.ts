import express from 'express';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { botManager } from './src/bot/botManager.js';
import { musicManager } from './src/bot/musicPlayer.js';
import { securityManager } from './src/bot/security.js';
import { searchAndResolveTrack, fetchSongLyrics } from './src/bot/audioResolver.js';
import { ChannelType, type TextChannel } from 'discord.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // --- BOT MANAGEMENT ENDPOINTS ---

  app.get('/api/bot/status', (req, res) => {
    res.json(botManager.getStatus());
  });

  app.get('/api/bot/logs', (req, res) => {
    res.json({ logs: botManager.getLogs() });
  });

  app.post('/api/bot/start', async (req, res) => {
    const { token, clientId } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Discord bot token is required.' });
    }
    const result = await botManager.start(token, clientId);
    res.json(result);
  });

  app.post('/api/bot/stop', async (req, res) => {
    await botManager.stop();
    res.json({ success: true, message: 'Bot stopped.' });
  });

  app.post('/api/bot/clear-commands', async (req, res) => {
    const { guildId } = req.body;
    const result = await botManager.cleanAndDeployCommands(guildId);
    res.json(result);
  });

  // --- INTERACTIVE EMBED PANEL DEPLOYMENT ---

  app.post('/api/bot/send-panel', async (req, res) => {
    const { guildId, textChannelId, customImageUrl } = req.body;
    if (!guildId || !textChannelId) {
      return res
        .status(400)
        .json({ success: false, message: 'Guild ID and Text Channel ID are required.' });
    }

    const client = botManager.getClient();
    if (!client || !client.isReady()) {
      return res.status(400).json({ success: false, message: 'Bot is currently offline.' });
    }

    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ success: false, message: 'Guild not found.' });

      const channel = guild.channels.cache.get(textChannelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        return res.status(400).json({ success: false, message: 'Invalid text channel.' });
      }

      await musicManager.sendOrAttachPanel(guildId, channel as TextChannel, customImageUrl);
      res.json({
        success: true,
        message: `Đã gửi Music Panel kèm Anime GIF vào kênh #${channel.name}!`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --- MUSIC QUEUE & PLAYBACK CONTROLS ---

  app.get('/api/bot/queue/:guildId', (req, res) => {
    const { guildId } = req.params;
    const gp = musicManager.getPlayer(guildId);
    res.json({
      guildId,
      currentTrack: gp.currentTrack,
      queue: gp.queue,
      isPlaying: gp.isPlaying,
      loopMode: gp.loopMode,
      filterMode: gp.filterMode,
      autoplay: gp.autoplay,
      stay247: gp.stay247,
      volume: gp.volume,
      playbackSeconds: gp.currentPlaybackSeconds,
      hasVoice: Boolean(gp.connection),
    });
  });

  app.get('/api/bot/lyrics', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({ success: false, message: 'Query is required.' });
    }
    const lyricsData = await fetchSongLyrics(query);
    if (!lyricsData) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lời bài hát.' });
    }
    res.json({ success: true, ...lyricsData });
  });

  app.post('/api/bot/queue/:guildId/add', async (req, res) => {
    const { guildId } = req.params;
    const { query, voiceChannelId, textChannelId, requester } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query or URL is required.' });
    }

    const client = botManager.getClient();
    let voiceChannel = undefined;
    let textChannel = undefined;

    if (client && client.isReady()) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        if (voiceChannelId) voiceChannel = guild.channels.cache.get(voiceChannelId) as any;
        if (textChannelId) textChannel = guild.channels.cache.get(textChannelId) as TextChannel;
      }
    }

    const track = await searchAndResolveTrack(query, requester || 'Dashboard Operator');
    if (!track) {
      return res.status(404).json({ success: false, message: 'Audio not found.' });
    }

    await musicManager.enqueue(guildId, track, voiceChannel, textChannel);
    if (textChannel && !musicManager.getPlayer(guildId).panelMessage) {
      await musicManager.sendOrAttachPanel(guildId, textChannel).catch(() => {});
    }
    botManager.addLog(
      'music',
      `Added "${track.title}" to queue via Web Dashboard`,
      client?.guilds.cache.get(guildId)?.name
    );

    res.json({ success: true, track, queue: musicManager.getPlayer(guildId).queue });
  });

  app.post('/api/bot/queue/:guildId/control', async (req, res) => {
    const { guildId } = req.params;
    const { action, value } = req.body;

    switch (action) {
      case 'togglePlay': {
        const isPlaying = musicManager.togglePlay(guildId);
        return res.json({ success: true, isPlaying });
      }
      case 'skip': {
        const skipped = musicManager.skip(guildId);
        return res.json({ success: true, skipped });
      }
      case 'seek': {
        const ok = musicManager.seek(guildId, Number(value) || 0);
        return res.json({ success: ok });
      }
      case 'autoplay': {
        const autoplay = musicManager.toggleAutoplay(guildId);
        return res.json({ success: true, autoplay });
      }
      case 'stay247': {
        const stay247 = musicManager.toggle247(guildId);
        return res.json({ success: true, stay247 });
      }
      case 'loop': {
        const loopMode = musicManager.setLoopMode(guildId, value);
        return res.json({ success: true, loopMode });
      }
      case 'cycleLoop': {
        const loopMode = musicManager.cycleLoop(guildId);
        return res.json({ success: true, loopMode });
      }
      case 'filter': {
        const filterMode = musicManager.setFilter(guildId, value);
        return res.json({ success: true, filterMode });
      }
      case 'cycleFilter': {
        const filterMode = musicManager.cycleFilter(guildId);
        return res.json({ success: true, filterMode });
      }
      case 'volume': {
        const volume = musicManager.setVolume(guildId, value);
        return res.json({ success: true, volume });
      }
      case 'shuffle': {
        const count = musicManager.shuffle(guildId);
        return res.json({ success: true, count });
      }
      case 'remove': {
        const removed = musicManager.remove(guildId, value);
        return res.json({ success: true, removed });
      }
      case 'clear': {
        musicManager.clearQueue(guildId);
        return res.json({ success: true });
      }
      case 'leave': {
        musicManager.leave(guildId);
        return res.json({ success: true });
      }
      default:
        return res.status(400).json({ success: false, message: 'Unknown action.' });
    }
  });

  // --- SECURITY, WARNINGS & GIVEAWAYS ---

  app.get('/api/bot/security/:guildId', (req, res) => {
    const { guildId } = req.params;
    res.json({
      config: securityManager.getConfig(guildId),
      warnings: securityManager.getWarnings(guildId),
      giveaways: securityManager.getGuildGiveaways(guildId),
    });
  });

  app.post('/api/bot/security/:guildId', (req, res) => {
    const { guildId } = req.params;
    const updated = securityManager.updateConfig(guildId, req.body);
    botManager.addLog(
      'security',
      `Security & Server settings updated via Dashboard`,
      req.params.guildId
    );
    res.json({ success: true, config: updated });
  });

  app.post('/api/bot/security/:guildId/action', async (req, res) => {
    const { guildId } = req.params;
    const { action, targetId, reason, minutes, roleId } = req.body;

    const client = botManager.getClient();
    if (!client || !client.isReady()) {
      return res.status(400).json({ success: false, message: 'Bot is offline.' });
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ success: false, message: 'Guild not found.' });

    try {
      let resultMsg = '';
      if (action === 'kick') {
        resultMsg = await securityManager.kickMember(guild, targetId, reason);
      } else if (action === 'ban') {
        resultMsg = await securityManager.banMember(guild, targetId, reason);
      } else if (action === 'mute') {
        resultMsg = await securityManager.muteMember(guild, targetId, minutes || 10, reason);
      } else if (action === 'unmute') {
        resultMsg = await securityManager.unmuteMember(guild, targetId);
      } else if (action === 'warn') {
        const w = await securityManager.warnMember(guild, targetId, 'Web Admin', reason);
        resultMsg = `Đã cảnh cáo ${w.record.userTag} (Lần ${w.totalUserWarnings}/3)${
          w.autoMuted ? ' -> Tự động Mute 30m!' : ''
        }`;
      } else if (action === 'clearwarns') {
        const count = securityManager.clearWarnings(guildId, targetId || undefined);
        resultMsg = `Đã xoá ${count} cảnh cáo.`;
      } else if (action === 'addRole' && roleId) {
        resultMsg = await securityManager.manageRole(guild, targetId, roleId, 'add');
      } else if (action === 'removeRole' && roleId) {
        resultMsg = await securityManager.manageRole(guild, targetId, roleId, 'remove');
      }

      botManager.addLog('security', resultMsg, guild.name);
      res.json({
        success: true,
        message: resultMsg,
        warnings: securityManager.getWarnings(guildId),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --- SERVER, CHANNEL, GIVEAWAY & POLL ENDPOINTS ---

  app.post('/api/bot/server/:guildId/channel-action', async (req, res) => {
    const { guildId } = req.params;
    const {
      channelId,
      action,
      amount,
      seconds,
      title,
      message,
      everyone,
      prize,
      minutes,
      winners,
      question,
      options,
    } = req.body;

    const client = botManager.getClient();
    if (!client || !client.isReady()) {
      return res.status(400).json({ success: false, message: 'Bot đang offline.' });
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ success: false, message: 'Không tìm thấy Server.' });

    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel || channel.type !== ChannelType.GuildText) {
      return res.status(400).json({ success: false, message: 'Kênh văn bản không hợp lệ.' });
    }

    try {
      let msg = '';
      if (action === 'purge') {
        const count = await securityManager.purgeMessages(channel, Number(amount) || 20);
        msg = `🧹 Đã dọn sạch ${count} tin nhắn trong kênh #${channel.name}!`;
      } else if (action === 'lock') {
        msg = await securityManager.setChannelLock(channel, true);
      } else if (action === 'unlock') {
        msg = await securityManager.setChannelLock(channel, false);
      } else if (action === 'slowmode') {
        msg = await securityManager.setSlowmode(channel, Number(seconds) || 0);
      } else if (action === 'nuke') {
        const cloned = await securityManager.nukeChannel(channel, 'Web Dashboard Admin');
        msg = `☢️ Đã làm mới (Nuke) hoàn toàn kênh #${cloned.name}!`;
      } else if (action === 'announce') {
        await securityManager.sendAnnouncement(
          channel,
          title || 'THÔNG BÁO SERVER',
          message || '',
          Boolean(everyone)
        );
        msg = `📢 Đã gửi thông báo Embed vào kênh #${channel.name}!`;
      } else if (action === 'giveaway') {
        await securityManager.createGiveaway(
          channel,
          prize || 'Nitro 1 Tháng',
          Number(minutes) || 10,
          Number(winners) || 1,
          'Web Dashboard Admin'
        );
        msg = `🎁 Đã phát động sự kiện Giveaway "${prize}" trong kênh #${channel.name}!`;
      } else if (action === 'poll') {
        const optArray = String(options || '')
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
        await securityManager.sendPoll(
          channel,
          question || 'Bình chọn Server',
          optArray,
          'Web Dashboard Admin'
        );
        msg = `📊 Đã tạo bảng bình chọn (Poll) trong kênh #${channel.name}!`;
      }

      botManager.addLog('server', msg, guild.name);
      res.json({ success: true, message: msg });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --- VITE DEV / PRODUCTION MIDDLEWARE ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);

    const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (token && token !== 'YOUR_DISCORD_BOT_TOKEN') {
      botManager.start(token, clientId).then((r) => {
        console.log('[Auto-Start]', r.message);
      });
    }
  });
}

startServer();
