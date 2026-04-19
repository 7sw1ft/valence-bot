const admin  = require('firebase-admin');
const config = require('../../config');
const { postToChannel } = require('../send');
const { revokeAllRoles } = require('../roles');
const log    = require('../log');

async function handleMemberLeave(client, db, member) {
  if (member.guild.id !== config.guildId) return;

  const discordId = member.user.id;
  const username  = member.user.username;
  log.info(`👋 Member left: ${username} (${discordId})`);

  // Check active staff
  try {
    const staffSnap = await db.collection('staff')
      .where('discordId', '==', discordId)
      .where('status', 'in', ['active', 'on_leave'])
      .limit(1).get();

    if (!staffSnap.empty) {
      const staffDoc  = staffSnap.docs[0];
      const staffData = staffDoc.data();
      const name      = staffData.rpName || staffData.robloxUsername || username;

      await staffDoc.ref.update({
        status:            'terminated',
        termDate:          new Date().toISOString().slice(0, 10),
        termReason:        'Left the Discord server',
        terminationReason: 'Left the Discord server',
        updatedAt:         admin.firestore.FieldValue.serverTimestamp(),
        history:           admin.firestore.FieldValue.arrayUnion({
          action:   'Auto-Terminated',
          reason:   'Left the Discord server',
          termDate: new Date().toISOString().slice(0, 10),
          by:       'Bot (auto)', at: Date.now(),
        }),
      });

      await revokeAllRoles(client, discordId).catch(() => {});

      await postToChannel(client, config.channels.staffAlerts,
        config.messages.autoTermChannel({ name, discordId }));

      log.info(`⚠️  Auto-terminated: ${name}`);
      return;
    }
  } catch (e) { log.error('memberLeave staff check:', e.message); }

  // Check pending application
  try {
    const appSnap = await db.collection('applications')
      .where('discordId', '==', discordId)
      .where('status', 'in', ['pending', 'accepted', 'offer_sent', 'agreement_signed'])
      .limit(1).get();

    if (!appSnap.empty) {
      const appDoc  = appSnap.docs[0];
      const appData = appDoc.data();
      const name    = appData.rpName || appData.robloxUsername || username;

      await appDoc.ref.update({
        status:          'rejected',
        rejectionNote:   'Applicant left the Discord server',
        reviewedAt:      admin.firestore.FieldValue.serverTimestamp(),
        reviewedByEmail: 'bot@valence.auto',
      });
      await db.collection('botPendingReplies').doc(discordId).delete().catch(() => {});

      await postToChannel(client, config.channels.staffAlerts,
        `📋 **Application Auto-Rejected** — **${name}** (\`${discordId}\`) left the server.\n` +
        `> Application status updated to **rejected** automatically.`
      );
      log.info(`⚠️  Application auto-rejected: ${name}`);
    }
  } catch (e) { log.error('memberLeave application check:', e.message); }
}

module.exports = { handleMemberLeave };
