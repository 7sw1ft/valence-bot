const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const admin  = require('firebase-admin');
const config = require('../../config');
const { sendDMRaw } = require('../send');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strike')
    .setDescription('Issue a strike to a staff member')
    .addUserOption(o => o.setName('member').setDescription('Discord member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the strike').setRequired(true))
    .addIntegerOption(o => o.setName('level').setDescription('Strike level (1/2/3)').setRequired(false)
      .addChoices({ name: 'Level 1 — Warning', value: 1 }, { name: 'Level 2 — Formal Warning', value: 2 }, { name: 'Level 3 — Final Warning', value: 3 })),

  async execute(interaction, client, db) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('member');
    const reason = interaction.options.getString('reason');
    const level  = interaction.options.getInteger('level') || 1;

    // Find staff record
    const snap = await db.collection('staff')
      .where('discordId', '==', target.id).where('status', '==', 'active').limit(1).get();

    if (snap.empty) {
      return interaction.editReply({ content: `❌ No active staff record found for <@${target.id}>.` });
    }

    const staffDoc  = snap.docs[0];
    const staffData = staffDoc.data();
    const name      = staffData.rpName || staffData.robloxUsername || target.username;
    const strikes   = staffData.strikes || [];
    const newCount  = strikes.length + 1;

    // Update Firestore
    await staffDoc.ref.update({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      strikes:   admin.firestore.FieldValue.arrayUnion({
        reason, level, issuedAt: Date.now(), by: interaction.user.id,
      }),
      history: admin.firestore.FieldValue.arrayUnion({
        action: 'Strike', strikeLevel: level, reason,
        by: interaction.user.tag, at: Date.now(),
      }),
    });

    // DM the staff member
    const text = config.messages.strikeIssued({ name, reason, strikeLevel: level, strikeCount: newCount });
    const fullText = `${text}\n${config.footer}`;
    try {
      await target.send({ content: fullText });
    } catch (e) {
      // DMs disabled — noted in reply
    }

    await interaction.editReply({
      content: `✅ Strike **Level ${level}** issued to **${name}** (${target.tag})\n> **Reason:** ${reason}\n> **Total strikes:** ${newCount}`,
    });
  },
};
