import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type PartialGuildMember,
  type Message,
  type TextChannel,
} from 'discord.js';
import type { AntiRaidConfig, WarningRecord, GiveawayItem, AfkEntry } from './types.js';
import { getNextAnimeGif, fetchWebAnimeGifByKeyword } from './embeds.js';

const INVITE_REGEX =
  /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9-]+/i;

const POLL_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export class SecurityManager {
  private configs = new Map<string, AntiRaidConfig>();
  private recentJoins = new Map<string, number[]>();
  private warnings = new Map<string, WarningRecord[]>(); // key: guildId
  private giveaways = new Map<string, GiveawayItem>(); // key: giveawayId
  private afkMap = new Map<string, AfkEntry>(); // key: `${guildId}_${userId}`

  getConfig(guildId: string): AntiRaidConfig {
    let cfg = this.configs.get(guildId);
    if (!cfg) {
      cfg = {
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
      };
      this.configs.set(guildId, cfg);
    }
    return cfg;
  }

  updateConfig(guildId: string, updates: Partial<AntiRaidConfig>): AntiRaidConfig {
    const cfg = this.getConfig(guildId);
    Object.assign(cfg, updates);
    return cfg;
  }

  // --- IN-DISCORD INTERACTIVE SETUP PANEL (.setup / /setup) ---

  buildSetupEmbed(guild: Guild): EmbedBuilder {
    const cfg = this.getConfig(guild.id);
    const welcomeCh = cfg.welcomeChannelId ? `<#${cfg.welcomeChannelId}>` : '`Chưa cài đặt`';
    const goodbyeCh = cfg.goodbyeChannelId ? `<#${cfg.goodbyeChannelId}>` : '`Chưa cài đặt`';
    const autoRole = cfg.autoRoleId ? `<@&${cfg.autoRoleId}>` : '`Chưa cài đặt`';

    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`⚙️ BẢNG CÀI ĐẶT SERVER TRỰC TIẾP TRÊN DISCORD — ${guild.name}`)
      .setDescription(
        'Chọn trực tiếp **Kênh Welcome**, **Kênh Goodbye**, **Auto-Role** và **Chủ đề GIF** bằng các thanh chọn bên dưới mà **không cần vào Web Dashboard**!\n\n' +
          '✨ **Đặc biệt:** Tin nhắn **Welcome** và **Goodbye** sẽ tự động lấy **GIF từ Web theo tên** (`anime hi` khi vào, `anime bye` khi thoát) và gửi **GIF trần (không nhốt trong khung Embed)** để hiển thị to, đẹp và tự nhiên nhất!'
      )
      .addFields(
        {
          name: '👋 Kênh Welcome (Chào mừng)',
          value: `${welcomeCh}\nTừ khoá GIF: \`${cfg.welcomeGifKeyword || 'anime hi'}\``,
          inline: true,
        },
        {
          name: '😢 Kênh Goodbye (Tạm biệt)',
          value: `${goodbyeCh}\nTừ khoá GIF: \`${cfg.goodbyeGifKeyword || 'anime bye'}\``,
          inline: true,
        },
        {
          name: '🎭 Auto-Role Khi Vào Server',
          value: autoRole,
          inline: true,
        },
        {
          name: '🛡️ Bảo Vệ Chống Link Mời & Anti-Raid',
          value:
            `Chống Link Mời: **${cfg.antiInviteLinks ? '✅ BẬT' : '❌ TẮT'}** | ` +
            `Anti-Raid: **${cfg.enabled ? '✅ BẬT' : '❌ TẮT'}** | ` +
            `Lockdown: **${cfg.lockdown ? '🚨 ĐANG KHOÁ' : '🔓 Bình thường'}**`,
          inline: false,
        }
      )
      .setFooter({
        text: 'Chọn kênh/role ở các menu bên dưới hoặc bấm Test Welcome / Test Goodbye để xem thử ngay!',
      })
      .setTimestamp();
  }

  buildSetupComponents(guildId: string): ActionRowBuilder<any>[] {
    const cfg = this.getConfig(guildId);

    const row1WelcomeChannel = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup_welcome_channel')
        .setPlaceholder('👋 1. Bấm để chọn Kênh Welcome (Chào mừng thành viên vào)...')
        .addChannelTypes(ChannelType.GuildText)
    );

    const row2GoodbyeChannel = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup_goodbye_channel')
        .setPlaceholder('😢 2. Bấm để chọn Kênh Goodbye (Báo khi thành viên rời đi)...')
        .addChannelTypes(ChannelType.GuildText)
    );

    const row3AutoRole = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('setup_autorole')
        .setPlaceholder('🎭 3. Bấm để chọn Role tự động cấp khi vào Server (Auto-Role)...')
    );

    const currentPair = `${cfg.welcomeGifKeyword}|${cfg.goodbyeGifKeyword}`;
    const row4GifStyle = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_gif_style')
        .setPlaceholder('🎬 4. Chọn kiểu GIF Web cho Welcome & Goodbye...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('👋 Mặc định: Welcome = "anime hi" | Goodbye = "anime bye"')
            .setDescription('Tự lấy GIF Anime vẫy tay chào (hi) và tạm biệt (bye) từ Web')
            .setValue('anime hi|anime bye')
            .setDefault(currentPair === 'anime hi|anime bye'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🎉 Sôi động: Welcome = "anime celebrate" | Goodbye = "anime cry"')
            .setDescription('Khi vào tung hoa ăn mừng, khi rời đi khóc tạm biệt')
            .setValue('anime celebrate|anime cry')
            .setDefault(currentPair === 'anime celebrate|anime cry'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🤗 Thân thiện: Welcome = "anime hug" | Goodbye = "anime wave"')
            .setDescription('Khi vào ôm chào đón, khi rời đi vẫy tay tạm biệt')
            .setValue('anime hug|anime wave')
            .setDefault(currentPair === 'anime hug|anime wave'),
          new StringSelectMenuOptionBuilder()
            .setLabel('💃 Âm nhạc: Welcome = "anime dance" | Goodbye = "anime sad"')
            .setDescription('Khi vào nhảy múa chào mừng, khi rời đi buồn bã')
            .setValue('anime dance|anime sad')
            .setDefault(currentPair === 'anime dance|anime sad')
        )
    );

    const row5Buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('setup_test_welcome')
        .setLabel('Test Welcome (Anime Hi)')
        .setEmoji('👋')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('setup_test_goodbye')
        .setLabel('Test Goodbye (Anime Bye)')
        .setEmoji('😢')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('setup_toggle_invite')
        .setLabel(`Chống Link: ${cfg.antiInviteLinks ? 'ON' : 'OFF'}`)
        .setEmoji('🛡️')
        .setStyle(cfg.antiInviteLinks ? ButtonStyle.Secondary : ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('setup_reset_channels')
        .setLabel('Tắt Welcome/Bye')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger)
    );

    return [
      row1WelcomeChannel,
      row2GoodbyeChannel,
      row3AutoRole,
      row4GifStyle,
      row5Buttons,
    ];
  }

  /**
   * Sends a borderless, non-Embed Welcome message + standalone Web Anime GIF ("anime hi")
   */
  async sendWelcomeNonEmbed(
    channel: TextChannel,
    userId: string,
    userTag: string,
    guildName: string,
    memberCount: number,
    keyword = 'anime hi'
  ): Promise<void> {
    const gifUrl = await fetchWebAnimeGifByKeyword(keyword || 'anime hi');
    // Send greeting text + direct GIF URL outside of any Embed so Discord displays the raw GIF cleanly!
    await channel.send({
      content:
        `👋 **WELCOME TO ${guildName.toUpperCase()}!** 🎉\n` +
        `Chào mừng <@${userId}> (\`${userTag}\`) đã gia nhập **${guildName}**!\n` +
        `✨ Bạn là thành viên thứ **#${memberCount}** của Server — chúc bạn nghe nhạc và trò chuyện vui vẻ nha!\n` +
        `${gifUrl}`,
    });
  }

  /**
   * Sends a borderless, non-Embed Goodbye message + standalone Web Anime GIF ("anime bye")
   */
  async sendGoodbyeNonEmbed(
    channel: TextChannel,
    userId: string,
    userTag: string,
    guildName: string,
    memberCount: number,
    keyword = 'anime bye'
  ): Promise<void> {
    const gifUrl = await fetchWebAnimeGifByKeyword(keyword || 'anime bye');
    await channel.send({
      content:
        `😢 **GOODBYE FROM ${guildName.toUpperCase()}...** 👋\n` +
        `Tạm biệt **${userTag}** (<@${userId}>) vừa rời khỏi **${guildName}**.\n` +
        `👥 Server hiện còn **${memberCount}** thành viên. Hẹn gặp lại bạn vào một ngày gần nhất!\n` +
        `${gifUrl}`,
    });
  }

  // --- AFK SYSTEM ---

  setAfk(guildId: string, userId: string, reason = 'Đang bận (AFK)'): AfkEntry {
    const entry: AfkEntry = {
      userId,
      reason: reason || 'Đang bận (AFK)',
      since: Date.now(),
    };
    this.afkMap.set(`${guildId}_${userId}`, entry);
    return entry;
  }

  async checkAndHandleAfk(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;
    const guildId = message.guild.id;

    if (!message.content.toLowerCase().startsWith('.afk')) {
      const selfKey = `${guildId}_${message.author.id}`;
      const selfAfk = this.afkMap.get(selfKey);
      if (selfAfk) {
        this.afkMap.delete(selfKey);
        const mins = Math.max(1, Math.round((Date.now() - selfAfk.since) / 60000));
        await message
          .reply(
            `👋 Chào mừng <@${message.author.id}> đã quay trở lại! (Đã gỡ trạng thái AFK sau ${mins} phút).`
          )
          .then((m) => setTimeout(() => m.delete().catch(() => {}), 6000))
          .catch(() => {});
      }
    }

    if (message.mentions.users.size > 0) {
      for (const [uid, user] of message.mentions.users) {
        if (uid === message.author.id) continue;
        const afk = this.afkMap.get(`${guildId}_${uid}`);
        if (afk) {
          const unixSec = Math.floor(afk.since / 1000);
          await message
            .reply(
              `💤 **${user.tag}** hiện đang AFK (<t:${unixSec}:R>) — **Lý do:** *${afk.reason}*`
            )
            .catch(() => {});
        }
      }
    }
  }

  // --- GIVEAWAY SYSTEM ---

  getGuildGiveaways(guildId: string): GiveawayItem[] {
    return Array.from(this.giveaways.values()).filter((g) => g.guildId === guildId);
  }

  private buildGiveawayEmbed(item: GiveawayItem, gifUrl: string): EmbedBuilder {
    const endUnix = Math.floor(item.endsAt / 1000);
    const embed = new EmbedBuilder()
      .setColor(item.ended ? 0x10b981 : 0xf43f5e)
      .setTitle(`🎁 SỰ KIỆN GIVEAWAY: ${item.prize.toUpperCase()}`)
      .setImage(gifUrl)
      .setFooter({ text: `Tổ chức bởi: ${item.hostTag} • ID: ${item.id}` })
      .setTimestamp();

    if (item.ended) {
      const winnerMentions =
        item.winnerIds.length > 0
          ? item.winnerIds.map((id) => `<@${id}>`).join(', ')
          : '*Không có ai tham gia*';
      embed.setDescription(
        `🎉 **Giveaway đã kết thúc!**\n\n` +
          `🏆 **Phần thưởng:** **${item.prize}**\n` +
          `👑 **Người chiến thắng:** ${winnerMentions}\n` +
          `👥 **Tổng người tham gia:** **${item.participants.length}** người`
      );
    } else {
      embed.setDescription(
        `Bấm vào nút **🎉 Tham Gia Giveaway** bên dưới để có cơ hội trúng thưởng!\n\n` +
          `🎁 **Phần thưởng:** **${item.prize}**\n` +
          `⏰ **Kết thúc:** <t:${endUnix}:R> (<t:${endUnix}:t>)\n` +
          `🏆 **Số giải:** **${item.winnerCount}** người trúng\n` +
          `👥 **Đã tham gia:** **${item.participants.length}** người`
      );
    }

    return embed;
  }

  private buildGiveawayComponents(item: GiveawayItem): ActionRowBuilder<ButtonBuilder>[] {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`gw_join_${item.id}`)
        .setLabel(`Tham Gia Giveaway (${item.participants.length})`)
        .setEmoji('🎉')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(item.ended),
      new ButtonBuilder()
        .setCustomId(`gw_end_${item.id}`)
        .setLabel(item.ended ? 'Đã Kết Thúc' : 'Quay Thưởng Ngay')
        .setEmoji('🎁')
        .setStyle(item.ended ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(item.ended)
    );
    return [row];
  }

  async createGiveaway(
    channel: TextChannel,
    prize: string,
    durationMinutes: number,
    winnerCount = 1,
    hostTag = 'Admin'
  ): Promise<GiveawayItem> {
    const id = `gw_${Date.now().toString(36)}`;
    const mins = Math.max(1, Math.min(10080, durationMinutes));
    const endsAt = Date.now() + mins * 60 * 1000;
    const gifUrl = await fetchWebAnimeGifByKeyword('anime celebrate');

    const item: GiveawayItem = {
      id,
      guildId: channel.guild.id,
      channelId: channel.id,
      messageId: '',
      prize,
      hostTag,
      endsAt,
      winnerCount: Math.max(1, Math.min(10, winnerCount)),
      participants: [],
      ended: false,
      winnerIds: [],
    };

    const msg = await channel.send({
      embeds: [this.buildGiveawayEmbed(item, gifUrl)],
      components: this.buildGiveawayComponents(item),
    });

    item.messageId = msg.id;
    this.giveaways.set(id, item);

    setTimeout(() => {
      this.endGiveaway(id, channel.guild).catch(() => {});
    }, mins * 60 * 1000);

    return item;
  }

  async toggleGiveawayParticipant(
    giveawayId: string,
    userId: string,
    guild: Guild
  ): Promise<{ joined: boolean; total: number; error?: string }> {
    const item = this.giveaways.get(giveawayId);
    if (!item || item.ended) {
      return { joined: false, total: 0, error: 'Giveaway này đã kết thúc!' };
    }

    const idx = item.participants.indexOf(userId);
    let joined = false;
    if (idx === -1) {
      item.participants.push(userId);
      joined = true;
    } else {
      item.participants.splice(idx, 1);
      joined = false;
    }

    try {
      const ch = guild.channels.cache.get(item.channelId) as TextChannel | undefined;
      if (ch) {
        const msg = await ch.messages.fetch(item.messageId).catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [this.buildGiveawayEmbed(item, getNextAnimeGif())],
            components: this.buildGiveawayComponents(item),
          });
        }
      }
    } catch {}

    return { joined, total: item.participants.length };
  }

  async endGiveaway(giveawayId: string, guild: Guild): Promise<GiveawayItem | null> {
    const item = this.giveaways.get(giveawayId);
    if (!item || item.ended) return item || null;

    item.ended = true;
    const pool = [...item.participants];
    const winners: string[] = [];

    while (winners.length < item.winnerCount && pool.length > 0) {
      const randIdx = Math.floor(Math.random() * pool.length);
      winners.push(pool.splice(randIdx, 1)[0]);
    }
    item.winnerIds = winners;

    try {
      const ch = guild.channels.cache.get(item.channelId) as TextChannel | undefined;
      if (ch) {
        const msg = await ch.messages.fetch(item.messageId).catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [this.buildGiveawayEmbed(item, getNextAnimeGif())],
            components: this.buildGiveawayComponents(item),
          });
        }

        if (winners.length > 0) {
          const mentions = winners.map((id) => `<@${id}>`).join(', ');
          await ch.send(
            `🎉 **CHÚC MỪNG NGƯỜI CHIẾN THẮNG GIVEAWAY!** 🎉\n` +
              `Chúc mừng ${mentions} đã trúng giải **${item.prize}**! Hãy liên hệ Ban Quản Trị để nhận thưởng!`
          );
        } else {
          await ch.send(
            `🎁 Giveaway **${item.prize}** đã kết thúc nhưng không có ai bấm tham gia.`
          );
        }
      }
    } catch {}

    return item;
  }

  // --- INTERACTIVE POLL BUILDER ---

  async sendPoll(
    channel: TextChannel,
    question: string,
    options: string[],
    authorTag: string
  ): Promise<Message> {
    const cleanOpts = options.filter((o) => o.trim().length > 0).slice(0, 10);
    const finalOpts = cleanOpts.length >= 2 ? cleanOpts : ['Đồng ý 👍', 'Không đồng ý 👎'];

    const desc = finalOpts
      .map((opt, idx) => `${POLL_EMOJIS[idx]} **${opt.trim()}**`)
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(`📊 BÌNH CHỌN SERVER: ${question}`)
      .setDescription(`${desc}\n\n*Hãy bấm vào biểu tượng cảm xúc bên dưới để bỏ phiếu!*`)
      .setImage(getNextAnimeGif())
      .setFooter({ text: `Tạo bởi ${authorTag} • Bình chọn công khai` })
      .setTimestamp();

    const msg = await channel.send({ embeds: [embed] });
    for (let i = 0; i < finalOpts.length; i++) {
      await msg.react(POLL_EMOJIS[i]).catch(() => {});
    }
    return msg;
  }

  // Handle member join: Lockdown, Anti-Raid, Auto-Role, and Non-Embed Welcome ("anime hi" GIF)
  async handleMemberJoin(member: GuildMember): Promise<{ isRaid: boolean; actionTaken?: string }> {
    const guildId = member.guild.id;
    const cfg = this.getConfig(guildId);

    if (cfg.lockdown) {
      try {
        await member.kick('Server is currently in Anti-Raid Lockdown mode.');
        return { isRaid: true, actionTaken: `Kicked ${member.user.tag} (Lockdown Mode)` };
      } catch {
        return { isRaid: true, actionTaken: `Failed to kick ${member.user.tag} (Missing Perms)` };
      }
    }

    if (cfg.enabled) {
      const now = Date.now();
      let joins = this.recentJoins.get(guildId) || [];
      joins = joins.filter((ts) => now - ts < cfg.timeWindowSeconds * 1000);
      joins.push(now);
      this.recentJoins.set(guildId, joins);

      if (joins.length >= cfg.joinThreshold) {
        if (cfg.action === 'kick') {
          try {
            await member.kick('Anti-Raid: Sudden surge in new joins detected.');
            return { isRaid: true, actionTaken: `Anti-Raid triggered! Kicked ${member.user.tag}` };
          } catch {}
        } else if (cfg.action === 'timeout') {
          try {
            await member.timeout(10 * 60 * 1000, 'Anti-Raid: Mass join spike protection');
            return {
              isRaid: true,
              actionTaken: `Anti-Raid triggered! Muted ${member.user.tag} for 10m`,
            };
          } catch {}
        } else if (cfg.action === 'ban') {
          try {
            await member.ban({ reason: 'Anti-Raid protection auto-ban' });
            return { isRaid: true, actionTaken: `Anti-Raid triggered! Banned ${member.user.tag}` };
          } catch {}
        }
      }
    }

    // Auto-Role assignment
    if (cfg.autoRoleId) {
      try {
        const role = member.guild.roles.cache.get(cfg.autoRoleId);
        if (role) {
          await member.roles.add(role, 'Auto-Role on join');
        }
      } catch {}
    }

    // Welcome Message (Non-Embed with standalone Web Anime "hi" GIF!)
    if (cfg.welcomeChannelId) {
      try {
        const ch = member.guild.channels.cache.get(cfg.welcomeChannelId) as TextChannel | undefined;
        if (ch && 'send' in ch) {
          await this.sendWelcomeNonEmbed(
            ch,
            member.id,
            member.user.tag,
            member.guild.name,
            member.guild.memberCount,
            cfg.welcomeGifKeyword || 'anime hi'
          );
        }
      } catch {}
    }

    return { isRaid: false };
  }

  // Handle member leave: Non-Embed Goodbye ("anime bye" GIF)
  async handleMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
    const guild = member.guild;
    const cfg = this.getConfig(guild.id);
    if (!cfg.goodbyeChannelId) return;

    try {
      const ch = guild.channels.cache.get(cfg.goodbyeChannelId) as TextChannel | undefined;
      if (ch && 'send' in ch) {
        const tag = member.user?.tag || 'Một thành viên';
        await this.sendGoodbyeNonEmbed(
          ch,
          member.id,
          tag,
          guild.name,
          guild.memberCount,
          cfg.goodbyeGifKeyword || 'anime bye'
        );
      }
    } catch {}
  }

  // Mass mention & Anti-Invite Link filter
  async checkMessageForSpam(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false;
    const cfg = this.getConfig(message.guild.id);

    const isAdmin = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);

    // 1. Check Anti-Invite Links
    if (cfg.antiInviteLinks && !isAdmin && INVITE_REGEX.test(message.content)) {
      try {
        await message.delete();
        if ('send' in message.channel) {
          await (message.channel as TextChannel).send({
            content: `🚫 **Chống Quảng Cáo**: Đã xoá link mời Discord từ <@${message.author.id}>! Không được gửi link mời server khác tại đây.`,
          });
        }
        return true;
      } catch (err) {
        console.error('[Security] Failed to delete invite link:', err);
      }
    }

    if (!cfg.enabled) return false;

    // 2. Check Mass Mentions
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount >= cfg.massMentionThreshold && !isAdmin) {
      try {
        await message.delete();
        if (message.member && message.member.moderatable) {
          await message.member.timeout(15 * 60 * 1000, 'Mass mention spam filter');
        }
        if ('send' in message.channel) {
          await (message.channel as TextChannel).send({
            content: `🛡️ **Anti-Raid**: Đã xoá tin nhắn từ <@${message.author.id}> do spam tag (${mentionCount} mentions). Đã tự động Mute 15 phút.`,
          });
        }
        return true;
      } catch (err) {
        console.error('[Security] Failed to action mass mention:', err);
      }
    }
    return false;
  }

  // --- WARNING SYSTEM ---

  getWarnings(guildId: string, userId?: string): WarningRecord[] {
    const list = this.warnings.get(guildId) || [];
    if (userId) return list.filter((w) => w.userId === userId);
    return list;
  }

  async warnMember(
    guild: Guild,
    targetId: string,
    moderator: string,
    reason = 'Vi phạm nội quy server'
  ): Promise<{ record: WarningRecord; totalUserWarnings: number; autoMuted: boolean }> {
    const member = await guild.members.fetch(targetId).catch(() => null);
    const userTag = member?.user?.tag || targetId;

    const record: WarningRecord = {
      id: `warn_${Date.now()}`,
      userId: targetId,
      userTag,
      moderator,
      reason,
      timestamp: new Date().toLocaleString(),
    };

    const list = this.warnings.get(guild.id) || [];
    list.unshift(record);
    this.warnings.set(guild.id, list);

    const userWarns = list.filter((w) => w.userId === targetId).length;
    let autoMuted = false;

    if (userWarns >= 3 && member && member.moderatable) {
      try {
        await member.timeout(
          30 * 60 * 1000,
          `Tự động Mute 30 phút do đạt ${userWarns} lần cảnh cáo`
        );
        autoMuted = true;
      } catch {}
    }

    return { record, totalUserWarnings: userWarns, autoMuted };
  }

  clearWarnings(guildId: string, userId?: string): number {
    const list = this.warnings.get(guildId) || [];
    if (!userId) {
      const count = list.length;
      this.warnings.set(guildId, []);
      return count;
    }
    const remaining = list.filter((w) => w.userId !== userId);
    const removedCount = list.length - remaining.length;
    this.warnings.set(guildId, remaining);
    return removedCount;
  }

  // --- CHANNEL & SERVER MANAGEMENT ---

  async purgeMessages(channel: TextChannel, amount: number): Promise<number> {
    const count = Math.max(1, Math.min(100, amount));
    const deleted = await channel.bulkDelete(count, true);
    return deleted.size;
  }

  async setChannelLock(channel: TextChannel, locked: boolean): Promise<string> {
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
      SendMessages: locked ? false : null,
    });
    return locked
      ? `🔒 Đã **KHOÁ** kênh <#${channel.id}> (Thành viên không thể nhắn tin).`
      : `🔓 Đã **MỞ KHOÁ** kênh <#${channel.id}>.`;
  }

  async setSlowmode(channel: TextChannel, seconds: number): Promise<string> {
    const sec = Math.max(0, Math.min(21600, seconds));
    await channel.setRateLimitPerUser(sec, 'Updated slowmode via Server Manager');
    return sec > 0
      ? `🐢 Đã bật chế độ chậm (**Slowmode: ${sec}s**) cho kênh <#${channel.id}>.`
      : `⚡ Đã tắt chế độ chậm (Slowmode) cho kênh <#${channel.id}>.`;
  }

  async nukeChannel(channel: TextChannel, executorTag: string): Promise<TextChannel> {
    const position = channel.position;
    const cloned = await channel.clone({
      name: channel.name,
      reason: `Channel nuked by ${executorTag}`,
    });
    await cloned.setPosition(position).catch(() => {});
    await channel.delete(`Channel nuked by ${executorTag}`);

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('☢️ Kênh Đã Được Làm Mới (Channel Nuked)')
      .setDescription(`Toàn bộ tin nhắn cũ đã được dọn sạch bởi **${executorTag}**.`)
      .setImage(getNextAnimeGif())
      .setTimestamp();

    await cloned.send({ embeds: [embed] });
    return cloned;
  }

  async sendAnnouncement(
    channel: TextChannel,
    title: string,
    content: string,
    mentionEveryone = false
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle(`📢 ${title || 'THÔNG BÁO SERVER'}`)
      .setDescription(content)
      .setImage(getNextAnimeGif())
      .setFooter({ text: `${channel.guild.name} • Ban Quản Trị` })
      .setTimestamp();

    await channel.send({
      content: mentionEveryone ? '@everyone' : undefined,
      embeds: [embed],
    });
  }

  async manageRole(
    guild: Guild,
    targetId: string,
    roleId: string,
    action: 'add' | 'remove'
  ): Promise<string> {
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) throw new Error('Không tìm thấy thành viên trong server.');
    const role = guild.roles.cache.get(roleId);
    if (!role) throw new Error('Không tìm thấy Role này.');

    if (action === 'add') {
      await member.roles.add(role);
      return `✅ Đã cấp Role **@${role.name}** cho **${member.user.tag}**.`;
    } else {
      await member.roles.remove(role);
      return `🗑️ Đã gỡ Role **@${role.name}** khỏi **${member.user.tag}**.`;
    }
  }

  // --- DIRECT MODERATION ---

  async kickMember(guild: Guild, targetId: string, reason = 'No reason provided'): Promise<string> {
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) throw new Error('Không tìm thấy thành viên trong server.');
    if (!member.kickable)
      throw new Error(
        'Không thể kick người này (Role cao hơn bot hoặc bot thiếu quyền Kick Members).'
      );
    await member.kick(reason);
    return `Đã Kick **${member.user.tag}** (${reason})`;
  }

  async banMember(guild: Guild, targetId: string, reason = 'No reason provided'): Promise<string> {
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (member && !member.bannable)
      throw new Error(
        'Không thể Ban người này (Role cao hơn bot hoặc bot thiếu quyền Ban Members).'
      );
    await guild.bans.create(targetId, { reason });
    return `Đã Ban ID **${targetId}** (${reason})`;
  }

  async muteMember(
    guild: Guild,
    targetId: string,
    durationMinutes = 10,
    reason = 'Muted by moderator'
  ): Promise<string> {
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) throw new Error('Không tìm thấy thành viên trong server.');
    if (!member.moderatable)
      throw new Error(
        'Không thể Mute người này (Role cao hơn bot hoặc thiếu quyền Moderate Members).'
      );
    await member.timeout(durationMinutes * 60 * 1000, reason);
    return `Đã Mute **${member.user.tag}** trong ${durationMinutes} phút (${reason}).`;
  }

  async unmuteMember(guild: Guild, targetId: string): Promise<string> {
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) throw new Error('Không tìm thấy thành viên trong server.');
    if (!member.moderatable) throw new Error('Không thể gỡ Mute cho người này.');
    await member.timeout(null, 'Unmuted by moderator');
    return `Đã gỡ Mute cho **${member.user.tag}**.`;
  }
}

export const securityManager = new SecurityManager();
