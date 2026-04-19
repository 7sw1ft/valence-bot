const admin  = require('firebase-admin');
const config = require('../config');
const log    = require('./log');

function withFooter(text) {
  return `${text}\n${config.footer}`;
}

/**
 * Send a deduplicated DM. Falls back to staffAlerts channel if DMs are closed.
 * @param {string}  actionedBy  - Name of admin who triggered this (for sig)
 * @param {boolean} addSig      - Append the "actioned by" signature block
 */
async function sendDM(client, db, discordId, text, dedupeKey, fallbackLabel = '', { skipFooter = false, actionedBy = null, addSig = false } = {}) {
  if (!discordId) { log.warn(`sendDM: no discordId for ${dedupeKey}`); return; }

  const ref = db.collection('botNotifLog').doc(dedupeKey);
  try {
    const doc = await ref.get();
    if (doc.exists) { log.info(`Skip duplicate: ${dedupeKey}`); return; }
  } catch (e) { log.warn('Dedupe check failed:', e.message); }

  let content = text;
  if (addSig && actionedBy) content += config.sig(actionedBy);
  if (!skipFooter)           content  = withFooter(content);

  try {
    const user = await client.users.fetch(discordId);
    await user.send({ content });
    await ref.set({ sentAt: admin.firestore.FieldValue.serverTimestamp(), discordId, dedupeKey });
    log.info(`✉️   DM → ${discordId} [${dedupeKey}]`);
  } catch (e) {
    if (e.code === 50007) {
      log.warn(`DMs closed for ${discordId} — fallback`);
      await _fallback(client, db, discordId, content, dedupeKey, fallbackLabel);
    } else {
      log.error(`DM failed [${dedupeKey}]:`, e.message);
    }
  }
}

async function sendDMRaw(client, discordId, text, skipFooter = false) {
  if (!discordId) return;
  const content = skipFooter ? text : withFooter(text);
  try {
    const user = await client.users.fetch(discordId);
    await user.send({ content });
    log.info(`✉️   DM raw → ${discordId}`);
  } catch (e) { log.error('DM raw failed:', e.message); }
}

async function postToChannel(client, channelId, text, embedOrNull = null) {
  if (!channelId || channelId.startsWith('CHANNEL')) {
    log.warn('postToChannel: not configured'); return;
  }
  try {
    const channel = await client.channels.fetch(channelId);
    if (embedOrNull) {
      await channel.send({ content: text || undefined, embeds: [embedOrNull] });
    } else {
      await channel.send({ content: text });
    }
    log.info(`📢  → channel ${channelId}`);
  } catch (e) { log.error(`postToChannel ${channelId}:`, e.message); }
}

async function _fallback(client, db, discordId, content, dedupeKey, label) {
  const chId = config.channels.staffAlerts;
  if (!chId || chId.startsWith('CHANNEL')) return;
  try {
    const ch = await client.channels.fetch(chId);
    await ch.send({ content: `⚠️ Could not DM <@${discordId}> (DMs disabled) — **${label || dedupeKey}**\n\n${content}` });
    await db.collection('botNotifLog').doc(dedupeKey).set({
      sentAt: admin.firestore.FieldValue.serverTimestamp(), discordId, dedupeKey, fallback: true,
    });
  } catch (e) { log.error('Fallback failed:', e.message); }
}

module.exports = { sendDM, sendDMRaw, postToChannel, withFooter };
