const admin  = require('firebase-admin');
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { sendDM, sendDMRaw, postToChannel, withFooter } = require('../send');
const { grantRoles, revokeAllRoles } = require('../roles');
const log    = require('../log');

const _prevStatus = new Map();

function startApplicationListeners(client, db) {

  db.collection('applications').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {

      // ── New application ──────────────────────────────────────────────────────
      if (change.type === 'added') {
        const app = change.doc.data();
        const ts  = app.submittedAt?.toDate?.();
        const age = ts ? Date.now() - ts.getTime() : 0;
        if (age < config.restartGuardMinutes * 60 * 1000) {
          await _postNewApp(client, change.doc.id, app);
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

      const name = app.rpName || app.robloxUsername || 'Applicant';
      const pos  = app.position || app.hiredAs || 'Staff';
      const did  = app.discordId;

      // Who reviewed this? Read from app doc or audit fields
      const actionedBy = app.reviewedByName || app.reviewedByEmail?.split('@')[0] || 'Valence HR';

      // ── Accepted → send offer DM ─────────────────────────────────────────────
      if (status === 'accepted' && app.hiringMethod !== 'manual') {
        const text = config.messages.offerExtended({ name, position: pos, actionedBy });
        await sendDM(client, db, did, text, `${appId}_offer_extended`, `Offer — ${name}`,
          { addSig: true, actionedBy });
        await db.collection('botPendingReplies').doc(did).set({
          action:     'offer_reply',
          appId,
          position:   pos,
          name,
          portalLink: app.portalLink || config.defaultPortalLink,
          createdAt:  admin.firestore.FieldValue.serverTimestamp(),
        });
        await _updateAppEmbed(client, change.doc, '🟡 Offer Extended', 0xf59e0b, actionedBy);
      }

      // ── Rejected ─────────────────────────────────────────────────────────────
      if (status === 'rejected') {
        const text = config.messages.rejected({ name, position: pos, actionedBy });
        await sendDM(client, db, did, text, `${appId}_rejected`, `Rejected — ${name}`,
          { addSig: true, actionedBy });
        await db.collection('botPendingReplies').doc(did).delete().catch(() => {});
        await _updateAppEmbed(client, change.doc, '🔴 Rejected', 0xe53e3e, actionedBy);
      }

      // ── Hired ────────────────────────────────────────────────────────────────
      if (status === 'hired') {
        const text = config.messages.hired({ name, position: pos, actionedBy });
        await sendDM(client, db, did, text, `${appId}_hired`, `Hired — ${name}`,
          { addSig: true, actionedBy });
        if (did) await grantRoles(client, did, pos);
        const rankerText = config.messages.rankerPing({
          name, robloxUsername: app.robloxUsername || '—', position: pos, discordId: did,
        });
        await postToChannel(client, config.channels.rankerPing, rankerText);
        await _updateAppEmbed(client, change.doc, '✅ Hired', 0x7ed957, actionedBy);
      }

      // ── Terminated ───────────────────────────────────────────────────────────
      if (status === 'terminated') {
        const text = config.messages.terminated({ name, actionedBy });
        await sendDM(client, db, did, text, `${appId}_terminated`, `Terminated — ${name}`,
          { addSig: true, actionedBy });
        if (app.terminationReason) {
          setTimeout(async () => {
            await sendDMRaw(client, did,
              config.messages.terminationReason({ reason: app.terminationReason }));
          }, 1500);
        }
        if (did) await revokeAllRoles(client, did);
      }
    });
  }, err => log.error('applications listener:', err));

  log.info('📋  Application listeners ready');
}

// Post new application to #applications-log as a rich embed
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
        { name: '🎮 Discord',    value: app.discordUsername || '—',   inline: true },
        { name: '💼 Position',   value: app.position || '—',          inline: true },
        { name: '🩺 Med Cert',   value: app.medCert || '—',           inline: true },
        { name: '📋 Experience', value: app.hasExperience || '—',     inline: true },
        { name: '🎮 Roblox ID',  value: String(app.robloxUid || '—'), inline: true },
        { name: '🆔 App ID',     value: `\`${appId.slice(0,12)}…\``,  inline: true },
      )
      .setFooter({ text: `Valence Healthcare · Application System` })
      .setTimestamp();
    await ch.send({ embeds: [embed] });
  } catch (e) { log.error('_postNewApp:', e.message); }
}

// Update existing embed in log channel with status change (if message id is stored)
async function _updateAppEmbed(client, docRef, statusLabel, color, actionedBy) {
  // Post a brief follow-up to the log channel instead of editing (simpler)
  const chId = config.channels.applicationsLog;
  if (!chId || chId.startsWith('CHANNEL')) return;
  const app = docRef.data();
  const name = app.rpName || app.robloxUsername || 'Applicant';
  try {
    const ch = await client.channels.fetch(chId);
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${statusLabel}`)
      .setDescription(`**${name}** — ${app.position || '—'}`)
      .addFields({ name: '✍️ Actioned by', value: actionedBy || 'Valence HR', inline: true })
      .setFooter({ text: `Valence Healthcare · Applications` })
      .setTimestamp();
    await ch.send({ embeds: [embed] });
  } catch (e) { /* silent */ }
}

module.exports = { startApplicationListeners };
