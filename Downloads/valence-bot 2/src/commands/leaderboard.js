const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show message activity leaderboard')
    .addStringOption(o => o.setName('period').setDescription('Time period').setRequired(false)
      .addChoices(
        { name: 'Weekly (default)', value: 'weekly' },
        { name: 'Daily',           value: 'daily' },
        { name: 'All Time',        value: 'alltime' },
      )),

  async execute(interaction, client, db) {
    await interaction.deferReply();

    const period = interaction.options.getString('period') || 'weekly';
    const field  = period === 'daily' ? 'dailyCount' : period === 'alltime' ? 'allTimeCount' : 'weeklyCount';
    const label  = period === 'daily' ? 'Today' : period === 'alltime' ? 'All Time' : 'This Week';

    const snap = await db.collection('messageTracking')
      .orderBy(field, 'desc').limit(15).get();

    if (snap.empty) {
      return interaction.editReply({ content: 'No message data yet. Start chatting!' });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const rows   = [];
    snap.forEach((doc, i) => {
      const d = doc.data();
      const count = d[field] || 0;
      if (!count) return;
      const medal = medals[rows.length] || `**${rows.length + 1}.**`;
      rows.push(`${medal} <@${doc.id}> — **${count.toLocaleString()}** msgs`);
    });

    const embed = new EmbedBuilder()
      .setColor(0x0097b2)
      .setTitle(`🏆 Message Leaderboard — ${label}`)
      .setDescription(rows.join('\n') || 'No activity yet.')
      .setFooter({ text: 'Valence Healthcare · Activity Tracking' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
