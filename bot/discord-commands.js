const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`🤖 Bot Command aktif sebagai ${client.user.tag}`);

  // Daftarin Slash Commands ke Discord
  const commands = [
    new SlashCommandBuilder()
      .setName('image')
      .setDescription('Generate an AI image based on your prompt')
      .addStringOption(option => 
        option.setName('prompt')
          .setDescription('Describe the image you want to create')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('Play Onyx Radio (Coming Soon)')
  ];

  try {
    await client.application.commands.set(commands);
    console.log('✅ Slash commands berhasil didaftarin!');
  } catch (error) {
    console.error('❌ Gagal daftar command:', error);
  }
});

// Respon saat user ngetik /image
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'image') {
    const prompt = interaction.options.getString('prompt');
    
    await interaction.deferReply(); // Kasih tau Discord kalau bot lagi mikir

    // Simulasi nunggu API gambar
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`;

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎨 AI Image Generated')
      .setDescription(`**Prompt:** ${prompt}`)
      .setImage(imageUrl)
      .setFooter({ text: 'Onyx Cloud — Powered by AI' });

    await interaction.editReply({ embeds: [embed] });
  }
  
  if (interaction.commandName === 'play') {
    await interaction.reply('📻 Fitur Radio Onyx lagi dibangun, tunggu ya!');
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
