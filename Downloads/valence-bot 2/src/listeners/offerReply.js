const admin  = require('firebase-admin');
const config = require('../../config');
const { sendDMRaw } = require('../send');
const log    = require('../log');

function startOfferReplyListener(client, db) {
  client.on('messageCreate', async message => {
    if (message.author.bot || message.guild) return;
    const discordId = message.author.id;
    let pending;
    try {
      const doc = await db.collection('botPendingReplies').doc(discordId).get();
      if (!doc.exists) return;
      pending = doc.data();
    } catch (e) { log.error('offerReply read:', e.message); return; }

    if (pending.action !== 'offer_reply') return;
    log.info(`📨 Offer reply from ${discordId} for app ${pending.appId}`);

    const portalLink = pending.portalLink || config.defaultPortalLink;
    await sendDMRaw(client, discordId, config.messages.portalLink({ portalLink }));

    try {
      await db.collection('applications').doc(pending.appId).update({
        status: 'offer_sent',
        offerReplied: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) { log.error('offerReply update:', e.message); }

    await db.collection('botPendingReplies').doc(discordId).delete().catch(() => {});
  });

  log.info('💬  Offer reply listener ready');
}

module.exports = { startOfferReplyListener };
