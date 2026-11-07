import {Client, GatewayIntentBits, ActivityType} from 'discord.js';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('ready', () => {
  console.log(`Bot logged in as ${client.user?.tag}`);
  client.user?.setActivity('Music & Security', {type: ActivityType.Listening});
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('!play')) {
    // Music logic here
  }
  
  if (message.content.startsWith('!kick')) {
    // Moderation logic here
  }
});

// Start bot
export const startBot = (token: string) => client.login(token);
