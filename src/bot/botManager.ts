import {
  Client,
  GatewayIntentBits,
  ActivityType,
  ChannelType,
  PermissionFlagsBits,
  type Interaction,
  type Message,
  type GuildMember,
} from 'discord.js';
import type { BotLog, BotStatus, GuildInfo } from './types.js';
import {
  handleSlashCommand,
  handlePrefixCommand,
  clearAndRegisterSlashCommands,
  buildHelpEmbed,
  buildHelpComponents,
  normalizeHelpCategory,
} from './commands.js';
import { musicManager } from './musicPlayer.js';
import { securityManager } from './security.js';
import { FILTER_LABELS } from './embeds.js';
import { getResolverCacheStats } from './audioResolver.js';

export class BotManager {
  private client: Client | null = null;
  private isOnline = false;
  private startTime: number = 0;
  private currentToken: string = '';
  private currentClientId: string = '';
  private logs: BotLog[] = [];

  constructor() {
    this.addLog('info', 'Discord Bot & Optimized Audio Engine initialized.');
  }

  addLog(type: BotLog['type'], message: string, guild?: string) {
    const log: BotLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      guild,
    };
    this.logs.unshift(log);
    if (this.logs.length > 150) this.logs.pop();
  }

  getLogs(): BotLog[] {
    return this.logs;
  }

  getClient(): Client | null {
    return this.client;
  }

  getStatus(): BotStatus {
    const isReady = this.client && this.client.isReady();
    const guilds: GuildInfo[] = [];

    if (isReady && this.client) {
      for (const [_, guild] of this.client.guilds.cache) {
        const voiceChannels: { id: string; name: string }[] = [];
        const textChannels: { id: string; name: string; slowmode?: number }[] = [];
        const roles: { id: string; name: string; color: string }[] = [];

        guild.channels.cache.forEach((ch: any) => {
          if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) {
            voiceChannels.push({ id: ch.id, name: ch.name });
          } else if (ch.type === ChannelType.GuildText) {
            textChannels.push({
              id: ch.id,
              name: ch.name,
              slowmode: ch.rateLimitPerUser || 0,
            });
          }
        });

        guild.roles.cache
          .filter((r) => r.name !== '@everyone' && !r.managed)
          .forEach((r) => {
            roles.push({
              id: r.id,
              name: r.name,
              color: r.hexColor || '#6366f1',
            });
          });

        guilds.push({
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL(),
          memberCount: guild.memberCount,
          boostTier: guild.premiumTier || 0,
          boostCount: guild.premiumSubscriptionCount || 0,
          voiceChannels,
          textChannels,
          roles,
        });
      }
    }

    const mem = process.memoryUsage();
    const cacheStats = getResolverCacheStats();

    return {
      isOnline: Boolean(isReady),
      botTag: this.client?.user?.tag || null,
      botId: this.client?.user?.id || this.currentClientId || null,
      avatarUrl: this.client?.user?.displayAvatarURL() || null,
      ping: this.client?.ws?.ping || 0,
      guildsCount: guilds.length,
      uptimeSeconds: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      guilds,
      activeQueuesCount: Array.from(musicManager.getAllPlayers().values()).filter(
        (p) => p.currentTrack || p.queue.length > 0
      ).length,
      metrics: {
        ramMb: Math.round(mem.rss / 1024 / 1024),
        heapMb: Math.round(mem.heapUsed / 1024 / 1024),
        searchCacheSize: cacheStats.searchCacheSize,
        streamCacheSize: cacheStats.streamCacheSize,
        cacheHits: cacheStats.cacheHits,
      },
    };
  }

  async start(token: string, clientId?: string): Promise<{ success: boolean; message: string }> {
    if (this.client && this.client.isReady()) {
      return { success: true, message: `Bot is already running as ${this.client.user?.tag}` };
    }

    this.currentToken = token.trim();
    if (clientId) this.currentClientId = clientId.trim();

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildVoiceStates,
          GatewayIntentBits.GuildMembers,
        ],
      });

      this.setupListeners(this.client);

      await this.client.login(this.currentToken);
      this.isOnline = true;
      this.startTime = Date.now();
      this.addLog('info', `Bot successfully logged in as ${this.client.user?.tag}`);

      return { success: true, message: `Logged in as ${this.client.user?.tag}` };
    } catch (err: any) {
      this.addLog('error', `Login failed: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      this.addLog('warn', 'Bot manually disconnected from Discord.');
      await this.client.destroy();
      this.client = null;
      this.isOnline = false;
      this.startTime = 0;
    }
  }

  async cleanAndDeployCommands(
    guildId?: string
  ): Promise<{ success: boolean; message: string; deleted: number; registered: number }> {
    const id = this.client?.user?.id || this.currentClientId;
    if (!this.currentToken || !id) {
      return {
        success: false,
        message: 'Bot token and Client ID are required to wipe and deploy slash commands.',
        deleted: 0,
        registered: 0,
      };
    }

    try {
      this.addLog('info', `Initiating command cleaner: purging old slash commands...`);
      const res = await clearAndRegisterSlashCommands(this.currentToken, id, guildId);
      this.addLog(
        'info',
        `Wiped ${res.deletedCount} old commands and registered ${res.registeredCount} fresh commands.`
      );
      return {
        success: true,
        message: `Đã xoá ${res.deletedCount} lệnh / cũ và cài đặt ${res.registeredCount} lệnh / mới thành công!`,
        deleted: res.deletedCount,
        registered: res.registeredCount,
      };
    } catch (err: any) {
      this.addLog('error', `Failed to purge & register slash commands: ${err.message}`);
      return {
        success: false,
        message: err.message,
        deleted: 0,
        registered: 0,
      };
    }
  }

  private setupListeners(client: Client) {
    client.once('ready', () => {
      this.addLog('info', `Bot ready on Discord! Watching ${client.guilds.cache.size} servers.`);
      client.user?.setActivity('Anime Music & Server Manager | .help /play', {
        type: ActivityType.Listening,
      });
    });

    client.on('interactionCreate', async (interaction: Interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          this.addLog(
            'info',
            `Slash command /${interaction.commandName} by ${interaction.user.tag}`,
            interaction.guild?.name
          );
          await handleSlashCommand(interaction);
          return;
        }

        if (interaction.isChannelSelectMenu()) {
          const { customId, guildId, guild, values } = interaction;
          if (!guildId || !guild) return;

          const member = interaction.member as any;
          if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({
              content: '❌ Bạn cần quyền **Manage Server (Quản lý máy chủ)** để chỉnh cài đặt kênh!',
              ephemeral: true,
            });
            return;
          }

          if (customId === 'setup_welcome_channel') {
            const channelId = values[0];
            securityManager.updateConfig(guildId, { welcomeChannelId: channelId });
            this.addLog('server', `Welcome channel set to <#${channelId}> by ${interaction.user.tag}`, guild.name);
            await interaction.update({
              embeds: [securityManager.buildSetupEmbed(guild)],
              components: securityManager.buildSetupComponents(guildId),
            });
            return;
          }

          if (customId === 'setup_goodbye_channel') {
            const channelId = values[0];
            securityManager.updateConfig(guildId, { goodbyeChannelId: channelId });
            this.addLog('server', `Goodbye channel set to <#${channelId}> by ${interaction.user.tag}`, guild.name);
            await interaction.update({
              embeds: [securityManager.buildSetupEmbed(guild)],
              components: securityManager.buildSetupComponents(guildId),
            });
            return;
          }
          return;
        }

        if (interaction.isRoleSelectMenu()) {
          const { customId, guildId, guild, values } = interaction;
          if (!guildId || !guild) return;

          const member = interaction.member as any;
          if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({
              content: '❌ Bạn cần quyền **Manage Server (Quản lý máy chủ)** để chọn Auto-Role!',
              ephemeral: true,
            });
            return;
          }

          if (customId === 'setup_autorole') {
            const roleId = values[0];
            securityManager.updateConfig(guildId, { autoRoleId: roleId });
            this.addLog('server', `Auto-Role set to <@&${roleId}> by ${interaction.user.tag}`, guild.name);
            await interaction.update({
              embeds: [securityManager.buildSetupEmbed(guild)],
              components: securityManager.buildSetupComponents(guildId),
            });
            return;
          }
          return;
        }

        if (interaction.isStringSelectMenu()) {
          if (interaction.customId === 'help_category_select') {
            const selected = normalizeHelpCategory(interaction.values[0]);
            this.addLog(
              'info',
              `Help category [${selected}] selected by ${interaction.user.tag}`,
              interaction.guild?.name
            );
            await interaction.update({
              embeds: [buildHelpEmbed(selected)],
              components: buildHelpComponents(selected),
            });
            return;
          }

          if (interaction.customId === 'setup_gif_style') {
            const { guildId, guild } = interaction;
            if (!guildId || !guild) return;

            const member = interaction.member as any;
            if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
              await interaction.reply({
                content: '❌ Bạn cần quyền **Manage Server** để đổi chủ đề GIF!',
                ephemeral: true,
              });
              return;
            }

            const [welcomeKey, goodbyeKey] = (interaction.values[0] || 'anime hi|anime bye').split('|');
            securityManager.updateConfig(guildId, {
              welcomeGifKeyword: welcomeKey || 'anime hi',
              goodbyeGifKeyword: goodbyeKey || 'anime bye',
            });
            this.addLog(
              'server',
              `GIF theme updated to [${welcomeKey} / ${goodbyeKey}] by ${interaction.user.tag}`,
              guild.name
            );
            await interaction.update({
              embeds: [securityManager.buildSetupEmbed(guild)],
              components: securityManager.buildSetupComponents(guildId),
            });
            return;
          }
          return;
        }

        if (interaction.isButton()) {
          const { customId, guildId, guild } = interaction;
          if (!guildId || !guild) return;

          // Setup Panel interactive buttons
          if (customId === 'setup_test_welcome') {
            const cfg = securityManager.getConfig(guildId);
            const targetChannelId = cfg.welcomeChannelId || interaction.channelId;
            await interaction.deferReply({ ephemeral: true });
            const ch = guild.channels.cache.get(targetChannelId);
            if (ch && ch.isTextBased()) {
              await securityManager.sendWelcomeNonEmbed(
                ch as any,
                interaction.user.id,
                interaction.user.tag,
                guild.name,
                guild.memberCount,
                cfg.welcomeGifKeyword || 'anime hi'
              );
              await interaction.editReply({
                content: `👋 Đã bắn thử tin nhắn **Welcome + GIF Web (${cfg.welcomeGifKeyword || 'anime hi'})** ra ngoài Embed tại <#${targetChannelId}>!`,
              });
            } else {
              await interaction.editReply({
                content: '❌ Không tìm thấy kênh văn bản để gửi (hãy chọn kênh Welcome trước).',
              });
            }
            return;
          }

          if (customId === 'setup_test_goodbye') {
            const cfg = securityManager.getConfig(guildId);
            const targetChannelId = cfg.goodbyeChannelId || cfg.welcomeChannelId || interaction.channelId;
            await interaction.deferReply({ ephemeral: true });
            const ch = guild.channels.cache.get(targetChannelId);
            if (ch && ch.isTextBased()) {
              await securityManager.sendGoodbyeNonEmbed(
                ch as any,
                interaction.user.id,
                interaction.user.tag,
                guild.name,
                guild.memberCount,
                cfg.goodbyeGifKeyword || 'anime bye'
              );
              await interaction.editReply({
                content: `💔 Đã bắn thử tin nhắn **Goodbye + GIF Web (${cfg.goodbyeGifKeyword || 'anime bye'})** ra ngoài Embed tại <#${targetChannelId}>!`,
              });
            } else {
              await interaction.editReply({
                content: '❌ Không tìm thấy kênh văn bản để gửi (hãy chọn kênh Goodbye trước).',
              });
            }
            return;
          }

          if (customId === 'setup_toggle_invite') {
            const member = interaction.member as any;
            if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
              await interaction.reply({
                content: '❌ Chỉ Quản trị viên mới có thể bật/tắt Anti-Invite!',
                ephemeral: true,
              });
              return;
            }
            const cfg = securityManager.getConfig(guildId);
            securityManager.updateConfig(guildId, { antiInviteLinks: !cfg.antiInviteLinks });
            await interaction.update({
              embeds: [securityManager.buildSetupEmbed(guild)],
              components: securityManager.buildSetupComponents(guildId),
            });
            return;
          }

          if (customId === 'setup_reset_channels') {
            const member = interaction.member as any;
            if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
              await interaction.reply({
                content: '❌ Chỉ Quản trị viên mới có thể xoá cài đặt!',
                ephemeral: true,
              });
              return;
            }
            securityManager.updateConfig(guildId, {
              welcomeChannelId: '',
              goodbyeChannelId: '',
              autoRoleId: '',
            });
            await interaction.update({
              embeds: [securityManager.buildSetupEmbed(guild)],
              components: securityManager.buildSetupComponents(guildId),
            });
            return;
          }

          // Giveaway Join / Draw buttons
          if (customId.startsWith('gw_join_')) {
            const gwId = customId.replace('gw_join_', '');
            const res = await securityManager.toggleGiveawayParticipant(
              gwId,
              interaction.user.id,
              guild
            );
            if (res.error) {
              await interaction.reply({ content: `❌ ${res.error}`, ephemeral: true });
            } else {
              await interaction.reply({
                content: res.joined
                  ? `🎉 Bạn đã đăng ký tham gia Giveaway! (Tổng: **${res.total}** người)`
                  : `👋 Bạn đã huỷ tham gia Giveaway. (Còn: **${res.total}** người)`,
                ephemeral: true,
              });
            }
            return;
          }

          if (customId.startsWith('gw_end_')) {
            const member = interaction.member as any;
            if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
              await interaction.reply({
                content: '❌ Chỉ Quản trị viên mới có thể quay thưởng sớm!',
                ephemeral: true,
              });
              return;
            }
            const gwId = customId.replace('gw_end_', '');
            await securityManager.endGiveaway(gwId, guild);
            await interaction.reply({
              content: '🎁 Đã quay thưởng và công bố kết quả Giveaway!',
              ephemeral: true,
            });
            return;
          }

          this.addLog(
            'music',
            `Panel button ${customId} clicked by ${interaction.user.tag}`,
            interaction.guild?.name
          );

          if (customId === 'btn_toggle_play') {
            const isPlaying = musicManager.togglePlay(guildId);
            await interaction.reply({
              content: isPlaying ? '▶️ Đã tiếp tục phát' : '⏸️ Đã tạm dừng',
              ephemeral: true,
            });
          } else if (customId === 'btn_skip') {
            const skipped = musicManager.skip(guildId);
            await interaction.reply({
              content: skipped ? `⏭️ Đã qua bài: **${skipped.title}**` : 'Không có bài nào đang phát',
              ephemeral: true,
            });
          } else if (customId === 'btn_loop') {
            const newMode = musicManager.cycleLoop(guildId);
            await interaction.reply({
              content: `🔁 Chế độ Loop: **${newMode.toUpperCase()}**`,
              ephemeral: true,
            });
          } else if (customId === 'btn_filter') {
            const nextFilter = musicManager.cycleFilter(guildId);
            await interaction.reply({
              content: `🎚️ Đã chuyển EQ sang: **${FILTER_LABELS[nextFilter]}**`,
              ephemeral: true,
            });
          } else if (customId === 'btn_autoplay') {
            const auto = musicManager.toggleAutoplay(guildId);
            await interaction.reply({
              content: auto
                ? '♾️ Đã **BẬT Autoplay**! Bot sẽ tự động phát nhạc liên quan khi hết Queue.'
                : '⏹️ Đã **TẮT Autoplay**.',
              ephemeral: true,
            });
          } else if (customId === 'btn_stop_leave') {
            musicManager.leave(guildId);
            await interaction.reply({
              content: '⏹️ Đã dừng nhạc và rời kênh thoại.',
              ephemeral: true,
            });
          } else if (customId === 'btn_view_queue') {
            const gp = musicManager.getPlayer(guildId);
            const list =
              gp.queue
                .map((t, idx) => `\`${idx + 1}.\` ${t.title} (\`${t.duration}\`)`)
                .slice(0, 10)
                .join('\n') || '*Hàng chờ trống*';
            await interaction.reply({
              content: `📋 **Hàng chờ hiện tại (${gp.queue.length} bài)**\n${list}`,
              ephemeral: true,
            });
          } else if (customId === 'btn_shuffle') {
            const count = musicManager.shuffle(guildId);
            await interaction.reply({
              content: `🔀 Đã trộn ngẫu nhiên ${count} bài trong hàng chờ.`,
              ephemeral: true,
            });
          } else if (customId === 'btn_vol_down') {
            const vol = musicManager.setVolume(guildId, -10);
            await interaction.reply({
              content: `🔉 Âm lượng giảm còn **${vol}%**`,
              ephemeral: true,
            });
          } else if (customId === 'btn_vol_up') {
            const vol = musicManager.setVolume(guildId, 10);
            await interaction.reply({
              content: `🔊 Âm lượng tăng lên **${vol}%**`,
              ephemeral: true,
            });
          } else if (customId === 'btn_refresh_panel') {
            musicManager.setCustomBanner(guildId, '');
            await musicManager.updatePanel(guildId);
            await interaction.reply({
              content: '🔄 Đã đổi sang Anime GIF tiếp theo & làm mới Panel!',
              ephemeral: true,
            });
          }
        }
      } catch (err: any) {
        console.error('[Interaction Error]', err);
        this.addLog('error', `Interaction error: ${err.message}`, interaction.guild?.name);
      }
    });

    client.on('messageCreate', async (message: Message) => {
      try {
        if (message.author.bot) return;

        const wasSpam = await securityManager.checkMessageForSpam(message);
        if (wasSpam) {
          this.addLog(
            'security',
            `Blocked spam / invite link from ${message.author.tag}`,
            message.guild?.name
          );
          return;
        }

        // Check AFK status & mentions
        await securityManager.checkAndHandleAfk(message);

        if (message.content.startsWith('.')) {
          this.addLog(
            'info',
            `Prefix command "${message.content.slice(0, 30)}" by ${message.author.tag}`,
            message.guild?.name
          );
          await handlePrefixCommand(message, '.');
        }
      } catch (err: any) {
        console.error('[MessageCreate Error]', err);
        this.addLog('error', `Prefix command error: ${err.message}`, message.guild?.name);
      }
    });

    client.on('guildMemberAdd', async (member: GuildMember) => {
      try {
        const raidCheck = await securityManager.handleMemberJoin(member);
        if (raidCheck.isRaid) {
          this.addLog(
            'security',
            `🚨 Anti-Raid Alert: ${raidCheck.actionTaken}`,
            member.guild.name
          );
        } else {
          this.addLog('server', `New member joined: ${member.user.tag} (sent Welcome GIF)`, member.guild.name);
        }
      } catch (err: any) {
        console.error('[GuildMemberAdd Error]', err);
      }
    });

    client.on('guildMemberRemove', async (member) => {
      try {
        await securityManager.handleMemberLeave(member);
        this.addLog('server', `Member left: ${member.user?.tag || member.id} (sent Goodbye GIF)`, member.guild.name);
      } catch (err: any) {
        console.error('[GuildMemberRemove Error]', err);
      }
    });

    client.on('error', (err) => {
      this.addLog('error', `Discord Client error: ${err.message}`);
    });
  }
}

export const botManager = new BotManager();
