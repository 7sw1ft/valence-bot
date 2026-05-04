const {
  SlashCommandBuilder, ButtonBuilder, ButtonStyle,
  ActionRowBuilder, EmbedBuilder, PermissionFlagsBits
} = require('discord.js');
const log = require('../log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Post the server verification panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Channel to post the panel in (defaults to current)')
      .setRequired(false)),

  async execute(interaction, client, db) {
    const target = interaction.options.getChannel('channel') || interaction.channel;

    const embed = new EmbedBuilder()
      .setColor(0x0097b2)
      .setTitle('Server Verification')
      .setDescription(
        'To gain access to Valence Healthcare, you must complete a short verification process.\n\n' +
        'Press the button below. The system will contact you via direct message with a verification code.'
      )
      .setFooter({ text: 'Valence Healthcare  ·  Verification System' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_start')
        .setLabel('Begin Verification')
        .setStyle(ButtonStyle.Primary)
    );

    await target.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `Verification panel posted in ${target}.`, ephemeral: true });
    log.info(`[Verify] Panel posted in #${target.name} by ${interaction.user.tag}`);
  },
};
