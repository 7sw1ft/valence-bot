const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const admin  = require('firebase-admin');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Blacklist and ban a user from all Valence servers')
    .addUserOption(o => o.setName('user').setDescription('User to blacklist').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for blacklist').setRequired(true))
    .addStringOption(o => o.setName('roblox').setDescription('Roblox username (optional)').setRequired(false)),

  async execute(interaction, client, db) {
    await interaction.deferReply({ ephemeral: true });

    // Only superadmins can blacklist
    const invoker = interaction.member;
    const isAdmin = invoker?.permissions?.has('BanMembers');
    if (!isAdmin) {
      return interaction.editReply({ content: '❌ You need **Ban Members** permission to use this command.' });
    }

    const target    = interaction.options.getUser('user');
    const reason    = interaction.options.getString('reason');
    const roblox    = interaction.options.getString('roblox') || '';
    const targetId  = target.id;

    const results = [];

    // 1. Add to Firestore blacklist (portal reads this)
    await db.collection('blacklist').add({
      type:            'individual',
      discordId:       targetId,
      discordUsername: target.username,
      robloxUsername:  roblox,
      reason,
      addedBy:         interaction.user.tag,
      addedAt:         admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Reject any pending applications
    try {
      const appSnap = await db.collection('applications')
        .where('discordId', '==', targetId)
        .where('status', 'in', ['pending', 'accepted', 'offer_sent', 'agreement_signed'])
        .get();
      for (const doc of appSnap.docs) {
        await doc.ref.update({ status: 'rejected', rejectionNote: `Blacklisted: ${reason}`, reviewedAt: admin.firestore.FieldValue.serverTimestamp(), reviewedByEmail: 'bot@valence.auto' });
      }
      if (!appSnap.empty) results.push(`✅ Rejected ${appSnap.size} pending application(s)`);
    } catch (e) { results.push(`⚠️ Could not update applications: ${e.message}`); }

    // 3. Terminate staff record if exists
    try {
      const staffSnap = await db.collection('staff')
        .where('discordId', '==', targetId).where('status', 'in', ['active', 'on_leave']).get();
      for (const doc of staffSnap.docs) {
        await doc.ref.update({
          status: 'terminated', termReason: `Blacklisted: ${reason}`,
          terminationReason: `Blacklisted: ${reason}`,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          history: admin.firestore.FieldValue.arrayUnion({
            action: 'Terminated', reason: `Blacklisted: ${reason}`,
            termDate: new Date().toISOString().slice(0, 10), by: 'Bot (blacklist)', at: Date.now(),
          }),
        });
      }
      if (!staffSnap.empty) results.push(`✅ Terminated ${staffSnap.size} staff record(s)`);
    } catch (e) { results.push(`⚠️ Could not terminate staff: ${e.message}`); }

    // 4. Ban from ALL guilds the bot is in
    let bannedFrom = 0;
    for (const [, guild] of client.guilds.cache) {
      try {
        await guild.bans.create(targetId, { reason: `Valence Blacklist: ${reason}` });
        bannedFrom++;
        results.push(`✅ Banned from **${guild.name}**`);
      } catch (e) {
        // User might not be in that guild or already banned
        if (e.code !== 10007 && e.code !== 40001) {
          results.push(`⚠️ Could not ban from **${guild.name}**: ${e.message}`);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xe53e3e)
      .setTitle('🚫 Blacklist Executed')
      .setDescription(`**${target.tag}** (\`${targetId}\`) has been blacklisted.`)
      .addFields(
        { name: 'Reason',      value: reason,               inline: false },
        { name: 'Roblox',      value: roblox || '—',        inline: true  },
        { name: 'Banned From', value: `${bannedFrom} server(s)`, inline: true },
        { name: 'Actions',     value: results.join('\n') || 'None', inline: false },
      )
      .setFooter({ text: `Blacklisted by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
