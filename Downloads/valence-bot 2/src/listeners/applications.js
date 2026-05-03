const admin  = require('firebase-admin');
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { sendDM, sendDMRaw, postToChannel } = require('../send');
const { grantRoles, revokeAllRoles } = require('../roles');
const log    = require('../log');

const _prevStatus = new Map();

function startApplicationListeners(client, db) {

  db.collection('applications').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {

      // ── New application ────────────────────────────────────────────────────
      if (change.type === 'added') {
        const app = change.doc.data();
        const ts  = app.submittedAt?.toDate?.();
        const age = ts ? Date.now() - ts.getTime() : 0;
        if (age < config.restartGuardMinutes * 60 * 1000) {
          // Post to applications-log channel
          await _postNewApp(client, change.doc.id, app);
          // Send "we received your application" DM
          if (app.discordId) {
            const name = app.rpName || app.robloxUsername || 'Applicant';
            const text = config.messages.applicationReceived({ name, position: app.position || 'Staff' });
            await sendDM(client, db, app.discordId, text,
              `appreceived_${change.doc.id}`, `App received — ${name}`);
          }
        }
        _prevStatus.set(change.doc.id, app.status);
        return;
      }

      if (change.type !== 'modified') return;

      const appId  = change.doc.id;
      const app    = change.doc.data();
      const status = app.status;
      const prev   = _prevStatus.get(appId);
      if (status === prev) return;
      _prevStatus.set(appId, status);

      const sig  = config.signature;
      const name = app.rpName || app.robloxUsername || 'Applicant';
      const pos  = app.position || app.hiredAs || 'Staff';
      const did  = app.discordId;

      if (status === 'accepted' && app.hiringMethod !== 'manual') {
        // Bot process: send offer DM + store pending reply
        const text = config.messages.offerExtended({ name, position: pos, signature: sig });
        await sendDM(client, db, did, text, `${appId}_offer_extended`, `Offer — ${name}`);
        await db.collection('botPendingReplies').doc(did).set({
          action: 'offer_reply', appId, position: pos, name,
          portalLink: app.portalLink || config.defaultPortalLink,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (status === 'rejected') {
        const text = config.messages.rejected({ name, position: pos, signature: sig });
        await sendDM(client, db, did, text, `${appId}_rejected`, `Rejected — ${name}`);
        await db.collection('botPendingReplies').doc(did).delete().catch(() => {});
      }

      if (status === 'hired') {
        const text = config.messages.hired({ name, position: pos, signature: sig });
        await sendDM(client, db, did, text, `${appId}_hired`, `Hired — ${name}`);
        if (did) await grantRoles(client, did, pos);
        const rankerText = config.messages.rankerPing({
          name, robloxUsername: app.robloxUsername || '—', position: pos, discordId: did,
        });
        await postToChannel(client, config.channels.rankerPing, rankerText);
      }

      if (status === 'terminated') {
        const text = config.messages.terminated({ name, signature: sig });
        await sendDM(client, db, did, text, `${appId}_terminated`, `Terminated — ${name}`);
        if (app.terminationReason) {
          setTimeout(async () => {
            await sendDMRaw(client, did, config.messages.terminationReason({ reason: app.terminationReason }));
          }, 1500);
        }
        if (did) await revokeAllRoles(client, did);
      }
    });
  }, err => log.error('applications listener:', err));

  log.info('📋  Application listeners ready');
}

async function _postNewApp(client, appId, app) {
  const chId = config.channels.applicationsLog;
  if (!chId || chId.startsWith('CHANNEL')) return;
  try {
    const ch = await client.channels.fetch(chId);
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('📝  New Application')
      .setDescription(`**${app.robloxUsername || '—'}** applied for **${app.position || '—'}**`)
      .addFields(
        { name: '🎮 Discord', value: app.discordUsername || '—', inline: true },
        { name: '🩺 Med Cert', value: app.medCert || '—', inline: true },
        { name: '📋 Experience', value: app.hasExperience || '—', inline: true },
      )
      .setFooter({ text: `ID: ${appId} · Valence Healthcare` })
      .setTimestamp();
    await ch.send({ embeds: [embed] });
  } catch (e) { log.error('_postNewApp:', e.message); }
}

module.exports = { startApplicationListeners };
