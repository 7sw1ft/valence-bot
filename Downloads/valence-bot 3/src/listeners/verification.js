/**
 * Valence Healthcare — Verification System  v1.0
 *
 * Flow:
 *   1.  User presses "Begin Verification" button in a channel.
 *   2.  Bot sends a DM with a 6-character alphanumeric captcha code.
 *   3.  User replies to the DM with the code (spaces are ignored).
 *   4.  Correct → grant configured verified role + log to Firestore.
 *   5.  Wrong   → up to 3 attempts, then 10-minute cooldown.
 *   6.  Expired → 15-minute code expiry.
 */

const { EmbedBuilder } = require('discord.js');
const admin  = require('firebase-admin');
const config = require('../../config');
const log    = require('../log');

// Charset: removes O/0, I/1 to avoid visual ambiguity
const CHARS    = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LEN      = 6;
const MAX_ATT  = 3;
const EXPIRE   = 15 * 60 * 1000;  // 15 min
const COOLDOWN = 10 * 60 * 1000;  // 10 min

// In-memory store: userId → { code, attempts, expiresAt } | { cooldownUntil }
const store = new Map();

function mkCode() {
  let s = '';
  for (let i = 0; i < LEN; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

async function handleVerification(client, db, event) {

  // ── Button press: initiate captcha ─────────────────────────────────────────
  if (event.isButton?.() && event.customId === 'verify_start') {
    const { user, guild } = event;
    const userId = user.id;

    // Already verified?
    const roleId = config.verification?.verifiedRoleId;
    if (roleId) {
      const member = guild
        ? await guild.members.fetch(userId).catch(() => null)
        : null;
      if (member?.roles.cache.has(roleId)) {
        return event.reply({ content: 'You are already verified.', ephemeral: true });
      }
    }

    // Cooldown check
    const existing = store.get(userId);
    if (existing?.cooldownUntil && Date.now() < existing.cooldownUntil) {
      const mins = Math.ceil((existing.cooldownUntil - Date.now()) / 60000);
      return event.reply({
        content: `You have exceeded the maximum number of attempts. Please try again in ${mins} minute(s).`,
        ephemeral: true,
      });
    }

    const code = mkCode();
    store.set(userId, { code, attempts: 0, expiresAt: Date.now() + EXPIRE });

    try {
      const dmUser = await client.users.fetch(userId);
      const embed = new EmbedBuilder()
        .setColor(0x0097b2)
        .setTitle('Verification Code')
        .setDescription(
          'Reply to this message with the code below to complete verification.\n\n' +
          `**\`${code.slice(0,3)} ${code.slice(3)}\`**\n\n` +
          '_Enter without spaces. This code expires in 15 minutes._'
        )
        .setFooter({ text: 'Valence Healthcare  ·  Verification System' });

      await dmUser.send({ embeds: [embed] });
      await event.reply({
        content: 'A verification code has been sent to your direct messages. Please check your DMs.',
        ephemeral: true,
      });
      log.info(`[Verify] Code dispatched → ${dmUser.tag} (${userId})`);
    } catch {
      store.delete(userId);
      await event.reply({
        content: 'Unable to send you a direct message. Please enable DMs from server members and try again.',
        ephemeral: true,
      });
    }
    return;
  }

  // ── DM reply: evaluate code ─────────────────────────────────────────────────
  if (event.channel?.isDMBased?.() && !event.author?.bot) {
    const userId = event.author.id;
    const entry  = store.get(userId);
    if (!entry?.code) return;

    if (Date.now() > entry.expiresAt) {
      store.delete(userId);
      return event.reply(
        'Your verification code has expired. Return to the server and press the verification button again.'
      );
    }

    const guess = event.content.replace(/\s+/g, '').toUpperCase();

    if (guess === entry.code) {
      store.delete(userId);

      // Grant role
      const roleId  = config.verification?.verifiedRoleId;
      let   granted = false;
      if (roleId) {
        try {
          const guild  = await client.guilds.fetch(config.guildId);
          const member = await guild.members.fetch(userId);
          await member.roles.add(roleId);
          granted = true;
          log.info(`[Verify] Role granted → ${event.author.tag}`);
        } catch (e) {
          log.error('[Verify] Role grant failed:', e.message);
        }
      }

      // Persist to Firestore
      try {
        await db.collection('verificationLog').add({
          discordId:       userId,
          discordUsername: event.author.username,
          verifiedAt:      admin.firestore.FieldValue.serverTimestamp(),
          guildId:         config.guildId,
        });
      } catch { /* non-critical */ }

      const embed = new EmbedBuilder()
        .setColor(0x7ed957)
        .setTitle('Verification Successful')
        .setDescription(
          granted
            ? 'Your account has been verified and server access has been granted. Welcome to Valence Healthcare.'
            : 'Your code was accepted. You may now access the server.'
        )
        .setFooter({ text: 'Valence Healthcare  ·  Verification System' });

      await event.reply({ embeds: [embed] });

    } else {
      entry.attempts++;
      const left = MAX_ATT - entry.attempts;

      if (left <= 0) {
        store.set(userId, { cooldownUntil: Date.now() + COOLDOWN });
        await event.reply(
          'Incorrect code. You have exceeded the maximum number of attempts.\n' +
          'Please wait 10 minutes, then return to the server and start verification again.'
        );
        log.warn(`[Verify] Max attempts exceeded → ${event.author.tag}`);
      } else {
        await event.reply(
          `Incorrect code. You have ${left} attempt(s) remaining. Please try again.`
        );
      }
    }
  }
}

module.exports = { handleVerification };
