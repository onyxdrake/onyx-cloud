const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ⚠️ REPLACE THIS with your actual #welcome channel ID
const WELCOME_CHANNEL_ID = '1561376527436746802'; 

client.once('ready', () => {
  console.log(`🤖 Discord Bot is running as ${client.user.tag}`);
});

client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) {
    console.error('❌ Welcome channel not found. Check WELCOME_CHANNEL_ID.');
    return;
  }

  // "Selling feelings" — Making the user feel like part of the family
  const embed = new EmbedBuilder()
    .setColor(0x00FF00) // Green color
    .setTitle(`🎉 Welcome, ${member.user.username}!`)
    .setDescription(
      `Hey <@${member.id}>! We're super stoked to have you join **Onyx Cloud**.\n\n` +
      `Here, you're not just a user; you're part of our big family. 🫂\n\n` +
      `**Here's what you can do:**\n` +
      `💬 Chat with the community in #general\n` +
      `🛠️ Report bugs in #bugs\n` +
      `💡 Share your ideas in #feedback\n` +
      `🎁 Claim your daily bonus via our Telegram bot\n\n` +
      `**Please read this first:**\n` +
      `📜 <#RULES_CHANNEL_ID>\n\n` // Don't forget to change RULES_CHANNEL_ID
      `If you're confused, don't hesitate to ask. We're here to help. ❤️`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setImage('https://i.imgur.com/your-welcome-banner.png') // Replace with your banner link
    .setFooter({ text: 'Onyx Cloud — The AI that executes' })
    .setTimestamp();

  channel.send({ content: `Hey <@${member.id}>, check out the welcome message above! 👆`, embeds: [embed] });
});

client.login(process.env.DISCORD_BOT_TOKEN);
