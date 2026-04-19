const { SlashCommandBuilder } = require('discord.js');
const admin  = require('firebase-admin');
const config = require('../../config');
const { sendDM } = require('../send');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loa')
    .setDescription('Manage Leave of Absence')
    .addSubcommand(s => s.setName('approve')
      .setDescription('Approve a LOA')
      .addUserOption(o => o.setName('member').setDescription('Staff member').setRequired(true))
      .addStringOption(o => o.setName('start').setDescription('Start date (YYYY-MM-DD)').setRequired(true))
      .addStringOption(o => o.setName('end').setDescription('End date (YYYY-MM-DD)').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('end')
      .setDescription('End a LOA early')
      .addUserOption(o => o.setName('member').setDescription('Staff member').setRequired(true))),

  async execute(interaction, client, db) {
    await interaction.deferReply({ ephemeral: true });
    const sub        = interaction.options.getSubcommand();
    const target     = interaction.options.getUser('member');
    const issuerName = interaction.member?.displayName || interaction.user.username;

    const snap = await db.collection('staff').where('discordId','==',target.id).limit(1).get();
    if (snap.empty)
      return interaction.editReply({ content: `❌ No staff record for <@${target.id}>.` });

    const staffDoc  = snap.docs[0];
    const staffData = staffDoc.data();
    const name      = staffData.rpName || staffData.robloxUsername || target.username;

    if (sub === 'approve') {
      const start    = interaction.options.getString('start');
      const end      = interaction.options.getString('end');
      const reason   = interaction.options.getString('reason') || '';
      const today    = new Date().toISOString().slice(0, 10);
      const days     = Math.round((new Date(end) - new Date(start)) / 86400000);
      const duration = days === 1 ? '1 day' : `${days} days`;

      const update = {
        loaStartDate: start, loaEndDate: end, loaReason: reason,
        loa: { status:'approved', start, end, reason },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        history: admin.firestore.FieldValue.arrayUnion({
          action:'Leave of Absence', startDate:start, endDate:end, reason, by:issuerName, at:Date.now(),
        }),
      };
      if (start <= today) update.status = 'on_leave';
      await staffDoc.ref.update(update);

      const text = config.messages.loaApproved({
        name, loaStart:start, loaEnd:end, loaDuration:duration, actionedBy:issuerName,
      });
      await sendDM(client, db, target.id, text, `loa_approved_cmd_${staffDoc.id}_${start}`,
        `LOA — ${name}`, { addSig:true, actionedBy:issuerName });

      return interaction.editReply({ content:`✅ LOA approved for **${name}** | \`${start}\` → \`${end}\` (${duration})` });

    } else if (sub === 'end') {
      await staffDoc.ref.update({
        status:'active',
        loaStartDate: admin.firestore.FieldValue.delete(),
        loaEndDate:   admin.firestore.FieldValue.delete(),
        loa:          admin.firestore.FieldValue.delete(),
        updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
        history: admin.firestore.FieldValue.arrayUnion({ action:'LOA Ended Early', by:issuerName, at:Date.now() }),
      });

      const text = config.messages.loaEndedEarly({ name, actionedBy:issuerName });
      await sendDM(client, db, target.id, text, `loa_end_cmd_${staffDoc.id}_${Date.now()}`,
        `LOA ended — ${name}`, { addSig:true, actionedBy:issuerName });

      return interaction.editReply({ content:`✅ LOA ended for **${name}**. Status: active.` });
    }
  },
};
