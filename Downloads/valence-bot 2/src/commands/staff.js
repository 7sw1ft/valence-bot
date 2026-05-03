const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Look up a staff member\'s profile')
    .addUserOption(o => o.setName('member').setDescription('Discord member to look up').setRequired(true)),

  async execute(interaction, client, db) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('member');

    const snap = await db.collection('staff')
      .where('discordId', '==', target.id).limit(1).get();

    if (snap.empty) {
      return interaction.editReply({ content: `❌ No staff record found for <@${target.id}>.` });
    }

    const s      = snap.docs[0].data();
    const status = s.status || 'active';
    const name   = s.rpName || s.robloxUsername || target.username;
    const strikes = s.strikes?.length || (s.history || []).filter(h => h.action === 'Strike').length;

    const statusEmoji = { active: '🟢', on_leave: '🟡', inactive: '⚪', terminated: '🔴' }[status] || '⚪';

    const embed = new EmbedBuilder()
      .setColor(status === 'active' ? 0x7ed957 : status === 'terminated' ? 0xe53e3e : 0xf59e0b)
      .setTitle(`${statusEmoji} ${name}`)
      .setThumbnail(target.displayAvatarURL({ size: 64 }))
      .addFields(
        { name: '🎮 Roblox',     value: s.robloxUsername || '—',                     inline: true },
        { name: '💼 Position',   value: s.role || s.position || '—',                  inline: true },
        { name: '🏢 Department', value: s.department || '—',                           inline: true },
        { name: '📅 Hire Date',  value: s.hireDate || '—',                             inline: true },
        { name: '🔴 Strikes',    value: String(strikes),                               inline: true },
        { name: '📊 Status',     value: status,                                        inline: true },
      )
      .setFooter({ text: 'Valence Healthcare · Staff Directory' })
      .setTimestamp();

    if (s.loa) {
      embed.addFields({ name: '🗓️ LOA', value: `${s.loa.start} → ${s.loa.end}`, inline: false });
    }

    // Recent history (last 3)
    const hist = (s.history || []).slice(-3).reverse();
    if (hist.length) {
      embed.addFields({
        name: '📋 Recent History',
        value: hist.map(h => `• **${h.action}** — ${h.reason || h.newRole || h.role || ''}`).join('\n'),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
