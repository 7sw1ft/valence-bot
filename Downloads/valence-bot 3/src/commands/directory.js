const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('directory')
    .setDescription('View the staff directory or look up a member')
    .addStringOption(o => o.setName('search').setDescription('Search by name, Roblox, or position').setRequired(false))
    .addStringOption(o => o.setName('department').setDescription('Filter by department').setRequired(false)),

  async execute(interaction, client, db) {
    await interaction.deferReply({ ephemeral: true });

    const search = (interaction.options.getString('search') || '').toLowerCase();
    const dept   = (interaction.options.getString('department') || '').toLowerCase();

    const snap = await db.collection('staff')
      .where('status', 'in', ['active', 'on_leave'])
      .orderBy('name').limit(50).get();

    let staff = [];
    snap.forEach(doc => staff.push({ id: doc.id, ...doc.data() }));

    if (search) {
      staff = staff.filter(s =>
        (s.name || '').toLowerCase().includes(search) ||
        (s.robloxUsername || '').toLowerCase().includes(search) ||
        (s.role || '').toLowerCase().includes(search) ||
        (s.position || '').toLowerCase().includes(search)
      );
    }
    if (dept) {
      staff = staff.filter(s => (s.department || '').toLowerCase().includes(dept));
    }

    if (!staff.length) {
      return interaction.editReply({ content: `❌ No staff found${search ? ` matching "${search}"` : ''}.` });
    }

    // Group by department
    const byDept = {};
    staff.forEach(s => {
      const d = s.department || 'General';
      if (!byDept[d]) byDept[d] = [];
      byDept[d].push(s);
    });

    const embed = new EmbedBuilder()
      .setColor(0x0097b2)
      .setTitle('👥 Staff Directory')
      .setFooter({ text: `${staff.length} staff members · Valence Healthcare` })
      .setTimestamp();

    let fieldCount = 0;
    for (const [deptName, members] of Object.entries(byDept)) {
      if (fieldCount >= 25) break;
      const lines = members.slice(0, 10).map(s => {
        const statusDot = s.status === 'on_leave' ? '🟡' : '🟢';
        const strikes = s.strikes?.length || 0;
        const strikeText = strikes ? ` ⚠️${strikes}` : '';
        return `${statusDot} **${s.name || s.robloxUsername}** — ${s.role || s.position || '—'}${strikeText}`;
      });
      if (members.length > 10) lines.push(`_+${members.length - 10} more..._`);
      embed.addFields({ name: `🏢 ${deptName}`, value: lines.join('\n') || '—', inline: false });
      fieldCount++;
    }

    // If single result, show more detail
    if (staff.length === 1) {
      const s = staff[0];
      embed.setTitle(`👤 ${s.name || s.robloxUsername}`)
        .setDescription(
          `**Position:** ${s.role || s.position || '—'}\n` +
          `**Department:** ${s.department || '—'}\n` +
          `**Roblox:** ${s.robloxUsername || '—'}\n` +
          `**Discord:** ${s.discordId ? `<@${s.discordId}>` : s.discordUsername || '—'}\n` +
          `**Hire Date:** ${s.hireDate || '—'}\n` +
          `**Status:** ${s.status || 'active'}\n` +
          `**Strikes:** ${s.strikes?.length || 0}`
        );
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
