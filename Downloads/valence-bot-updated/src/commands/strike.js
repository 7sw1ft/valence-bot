const { SlashCommandBuilder } = require('discord.js');
const admin  = require('firebase-admin');
const config = require('../../config');
const { sendDM } = require('../send');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strike')
    .setDescription('Issue or pardon a strike for a staff member')
    .addSubcommand(s => s.setName('issue')
      .setDescription('Issue a strike')
      .addUserOption(o => o.setName('member').setDescription('Discord member').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true))
      .addIntegerOption(o => o.setName('level').setDescription('Strike level').setRequired(false)
        .addChoices({name:'Level 1 — Warning',value:1},{name:'Level 2 — Formal Warning',value:2},{name:'Level 3 — Final Warning',value:3})))
    .addSubcommand(s => s.setName('pardon')
      .setDescription('Remove the latest strike')
      .addUserOption(o => o.setName('member').setDescription('Discord member').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for pardon').setRequired(false))),

  async execute(interaction, client, db) {
    await interaction.deferReply({ ephemeral: true });
    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getUser('member');
    const issuerName = interaction.member?.displayName || interaction.user.username;

    const snap = await db.collection('staff')
      .where('discordId','==',target.id).where('status','==','active').limit(1).get();
    if (snap.empty)
      return interaction.editReply({ content: `❌ No active staff record for <@${target.id}>.` });

    const staffDoc  = snap.docs[0];
    const staffData = staffDoc.data();
    const name      = staffData.rpName || staffData.robloxUsername || target.username;

    if (sub === 'issue') {
      const reason  = interaction.options.getString('reason');
      const level   = interaction.options.getInteger('level') || 1;
      const strikes = staffData.strikes || [];

      await staffDoc.ref.update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        strikes:   admin.firestore.FieldValue.arrayUnion({ reason, level, issuedAt:Date.now(), by:issuerName }),
        history:   admin.firestore.FieldValue.arrayUnion({ action:'Strike', strikeLevel:level, reason, by:issuerName, at:Date.now() }),
      });

      const text = config.messages.strikeIssued({
        name, reason, strikeLevel: level, strikeCount: strikes.length + 1, actionedBy: issuerName,
      });
      await sendDM(client, db, target.id, text, `strike_cmd_${staffDoc.id}_${Date.now()}`,
        `Strike — ${name}`, { addSig: true, actionedBy: issuerName });

      return interaction.editReply({
        content: `✅ Strike **Level ${level}** issued to **${name}**\n> **Reason:** ${reason}\n> **Total:** ${strikes.length + 1}`,
      });
    }

    if (sub === 'pardon') {
      const reason  = interaction.options.getString('reason') || 'Administrative review';
      const strikes = [...(staffData.strikes || [])];
      if (!strikes.length)
        return interaction.editReply({ content: `ℹ️ **${name}** has no strikes to pardon.` });

      strikes.pop();
      await staffDoc.ref.update({
        strikes, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        history: admin.firestore.FieldValue.arrayUnion({ action:'Strike Pardoned', reason, by:issuerName, at:Date.now() }),
      });

      const text = config.messages.strikePardoned({
        name, reason, strikeCount: strikes.length, actionedBy: issuerName,
      });
      await sendDM(client, db, target.id, text, `strike_pardon_cmd_${staffDoc.id}_${Date.now()}`,
        `Strike pardoned — ${name}`, { addSig: true, actionedBy: issuerName });

      return interaction.editReply({
        content: `✅ Strike pardoned for **${name}**. Remaining: **${strikes.length}**`,
      });
    }
  },
};
