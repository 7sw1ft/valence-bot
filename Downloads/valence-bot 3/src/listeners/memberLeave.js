const admin  = require('firebase-admin');
const config = require('../../config');
const { sendDMRaw } = require('../send');
const { revokeAllRoles } = require('../roles');
const log    = require('../log');

async function handleMemberLeave(client, db, member) {
  if (member.guild.id !== config.guildId) return;

  const discordId = member.user.id;
  const username  = member.user.username;
  log.info(`👋 Member left: ${username} (${discordId})`);

  // 1. Check if active staff
  try {
    const staffSnap = await db.collection('staff')
      .where('discordId', '==', discordId)
      .where('status', 'in', ['active', 'on_leave'])
      .limit(1).get();

    if (!staffSnap.empty) {
      const staffDoc  = staffSnap.docs[0];
      const staffData = staffDoc.data();
      const name      = staffData.rpName || staffData.robloxUsername || username;

      log.info(`⚠️  Active staff left server: ${name}`);

      // Mark terminated in Firestore
      await staffDoc.ref.update({
        status:             'terminated',
        termDate:           new Date().toISOString().slice(0, 10),
        termReason:         'Left the Discord server',
        terminationReason:  'Left the Discord server',
        updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
        history:            admin.firestore.FieldValue.arrayUnion({
          action:   'Terminated',
          reason:   'Left the Discord server',
          termDate: new Date().toISOString().slice(0, 10),
          by:       'Bot (auto)',
          at:       Date.now(),
        }),
      });

      // Post alert to staff channel
      const chId = config.channels.staffAlerts;
      if (chId && !chId.startsWith('CHANNEL')) {
        const ch = await client.channels.fetch(chId);
        await ch.send({
          content:
            `🚨 **Auto-Termination Alert**\n` +
            `> **${name}** (\`${discordId}\`) left the server and has been automatically terminated.\n` +
            `> Their staff record has been updated. No DM was sent (they left the server).`,
        });
      }
      return;
    }
  } catch (e) { log.error('memberLeave staff check:', e.message); }

  // 2. Check for pending application
  try {
    const appSnap = await db.collection('applications')
      .where('discordId', '==', discordId)
      .where('status', 'in', ['pending', 'accepted', 'offer_sent', 'agreement_signed'])
      .limit(1).get();

    if (!appSnap.empty) {
      const appDoc  = appSnap.docs[0];
      const appData = appDoc.data();
      const name    = appData.rpName || appData.robloxUsername || username;

      log.info(`⚠️  Applicant left server: ${name}`);

      await appDoc.ref.update({
        status:          'rejected',
        rejectionNote:   'Applicant left the Discord server',
        reviewedAt:      admin.firestore.FieldValue.serverTimestamp(),
        reviewedByEmail: 'bot@valence.auto',
      });

      // Clean up pending offer reply if any
      await db.collection('botPendingReplies').doc(discordId).delete().catch(() => {});
    }
  } catch (e) { log.error('memberLeave application check:', e.message); }
}

module.exports = { handleMemberLeave };
