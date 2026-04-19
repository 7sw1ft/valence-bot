const config = require('../../config');
const admin  = require('firebase-admin');
const { sendDM, postToChannel } = require('../send');
const { grantRoles, revokeAllRoles } = require('../roles');
const log    = require('../log');

// Track previous staff state
const _prev = new Map(); // uid → { loa, strikes, status, position, awards, strikeCount }

function startStaffListeners(client, db) {

  // ── Staff collection — catch all meaningful changes ─────────────────────────
  db.collection('staff').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'removed') return;
      const uid  = change.doc.id;
      const d    = change.doc.data();
      const did  = d.discordId;
      const name = d.rpName || d.robloxUsername || 'Staff Member';
      const prev = _prev.get(uid) || {};

      // Who did this action? Read from latest history entry
      const history    = d.history || [];
      const lastEntry  = history[history.length - 1];
      const actionedBy = lastEntry?.by || 'Valence HR';

      // ── 1. PROMOTION / DEMOTION ─────────────────────────────────────────────
      const position = d.position || d.role || '';
      const prevPos  = prev.position || '';
      if (prevPos && position && prevPos !== position && did) {
        // Determine if promotion or demotion (heuristic: check history action)
        const isPromotion = history.some(h =>
          h.action?.toLowerCase().includes('promot') && h.at > (Date.now() - 30000)
        ) || true; // default to promotion; can refine with rank system

        const msgFn  = isPromotion ? config.messages.promoted : config.messages.demoted;
        const key    = `pos_change_${uid}_${Date.now()}`;
        const label  = isPromotion ? 'Promotion' : 'Demotion';
        const text   = msgFn({ name, oldPosition: prevPos, newPosition: position, actionedBy });

        await sendDM(client, db, did, text, key, `${label} — ${name}`,
          { addSig: true, actionedBy });

        // Update Discord roles for new position
        if (isPromotion) {
          await grantRoles(client, did, position).catch(e => log.warn('grantRoles:', e.message));
        }

        // Post to staff-updates channel
        await postToChannel(client, config.channels.staffUpdates,
          `🎖️  **${isPromotion ? 'Promotion' : 'Position Update'}** — ` +
          `**${name}** | ${prevPos} → **${position}**`
        );

        log.info(`${label}: ${name} — ${prevPos} → ${position}`);
      }

      // ── 2. LOA APPROVED ─────────────────────────────────────────────────────
      const loa     = d.loa;
      const prevLoa = prev.loa;
      if (loa?.status === 'approved' && prevLoa?.status !== 'approved' && did) {
        const duration = _calcDuration(loa.start, loa.end);
        const text = config.messages.loaApproved({
          name, loaStart: loa.start || '—', loaEnd: loa.end || '—',
          loaDuration: duration, actionedBy,
        });
        await sendDM(client, db, did, text, `loa_approved_${uid}_${loa.start}`,
          `LOA — ${name}`, { addSig: true, actionedBy });

        // Post to LOA log channel
        if (config.channels.loaLog) {
          await postToChannel(client, config.channels.loaLog,
            `🗓️  **LOA Approved** — **${name}** | ${loa.start} → ${loa.end} (${duration}) | by ${actionedBy}`
          );
        }
      }

      // ── 3. LOA ENDED EARLY ──────────────────────────────────────────────────
      if (prevLoa?.status === 'approved' && d.status === 'active' && prev.status === 'on_leave' && did) {
        const text = config.messages.loaEndedEarly({ name, actionedBy });
        await sendDM(client, db, did, text, `loa_ended_${uid}_${Date.now()}`,
          `LOA ended — ${name}`, { addSig: true, actionedBy });
      }

      // ── 4. STRIKES (new strike added) ───────────────────────────────────────
      const strikes     = d.strikes || [];
      const prevStrikes = prev.strikeCount || 0;
      if (strikes.length > prevStrikes && did) {
        const latest = strikes[strikes.length - 1];
        const text = config.messages.strikeIssued({
          name, reason: latest?.reason || '—',
          strikeLevel: latest?.level || strikes.length,
          strikeCount:  strikes.length,
          actionedBy:   latest?.by || actionedBy,
        });
        await sendDM(client, db, did, text, `strike_${uid}_${strikes.length}`,
          `Strike — ${name}`, { addSig: true, actionedBy: latest?.by || actionedBy });
      }

      // ── 5. STRIKE PARDONED ──────────────────────────────────────────────────
      if (strikes.length < prevStrikes && did && prevStrikes > 0) {
        const pardonEntry = history.findLast?.(h => h.action?.toLowerCase().includes('pardon'))
          || lastEntry;
        const text = config.messages.strikePardoned({
          name, reason: pardonEntry?.reason || 'Administrative review',
          strikeCount: strikes.length, actionedBy,
        });
        await sendDM(client, db, did, text, `strike_pardon_${uid}_${Date.now()}`,
          `Strike pardoned — ${name}`, { addSig: true, actionedBy });
      }

      // ── 6. AWARD RECEIVED ───────────────────────────────────────────────────
      const awards     = d.awards || [];
      const prevAwards = prev.awards || 0;
      if (awards.length > prevAwards && did) {
        const latest = awards[awards.length - 1];
        const text = config.messages.awardReceived({
          name,
          awardTitle: latest?.title || latest?.award || 'Award',
          awardDesc:  latest?.description || '',
          actionedBy: latest?.by || actionedBy,
        });
        await sendDM(client, db, did, text, `award_${uid}_${awards.length}`,
          `Award — ${name}`, { addSig: true, actionedBy: latest?.by || actionedBy });

        await postToChannel(client, config.channels.staffUpdates,
          `🏆  **Award** — **${name}** received **${latest?.title || 'an award'}** | by ${actionedBy}`
        );
      }

      // ── 7. PROFILE UPDATED (significant changes, not just timestamps) ────────
      const significantChange = (
        (d.rpName && d.rpName !== prev.rpName) ||
        (d.department && d.department !== prev.department) ||
        (d.medCert && d.medCert !== prev.medCert)
      );
      if (significantChange && did && prev.rpName !== undefined) {
        const changes = [];
        if (d.rpName !== prev.rpName)         changes.push(`RP Name: ${d.rpName}`);
        if (d.department !== prev.department)  changes.push(`Department: ${d.department}`);
        if (d.medCert !== prev.medCert)        changes.push(`Med Cert: ${d.medCert}`);

        const text = config.messages.profileUpdated({
          name, changes: changes.join(', '), actionedBy,
        });
        await sendDM(client, db, did, text, `profile_upd_${uid}_${Date.now()}`,
          `Profile updated — ${name}`, { addSig: true, actionedBy });
      }

      // Update cache
      _prev.set(uid, {
        loa:         loa ? { ...loa } : null,
        strikeCount: strikes.length,
        status:      d.status,
        position:    position,
        awards:      awards.length,
        rpName:      d.rpName,
        department:  d.department,
        medCert:     d.medCert,
      });
    });
  }, err => log.error('staff listener:', err));

  // ── Portal LOA requests — approved by portal admin ──────────────────────────
  db.collection('loaRequests').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'modified') {
        const req = change.doc.data();
        if (req.status !== 'approved' || req.botProcessed) return;
        const { discordId, staffName, startDate, endDate, type, reason, reviewedBy } = req;
        if (!discordId) return;

        try {
          await change.doc.ref.update({ botProcessed: true });
          const duration   = _calcDuration(startDate, endDate);
          const actionedBy = reviewedBy || 'Valence HR';
          const text = config.messages.loaApproved({
            name: staffName, loaStart: startDate, loaEnd: endDate,
            loaDuration: duration, actionedBy,
          });
          await sendDM(client, db, discordId, text, `portal_loa_${change.doc.id}`,
            `LOA (portal) — ${staffName}`, { addSig: true, actionedBy });

          // Write to staff record
          const staffSnap = await db.collection('staff').where('discordId','==',discordId).limit(1).get();
          if (!staffSnap.empty) {
            const today = new Date().toISOString().slice(0, 10);
            const upd = {
              loaStartDate: startDate, loaEndDate: endDate, loaReason: reason || '',
              loa: { status:'approved', start:startDate, end:endDate, reason:reason||'', type:type||'personal' },
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              history: admin.firestore.FieldValue.arrayUnion({
                action:'Leave of Absence (portal)', startDate, endDate,
                reason:reason||'', by:actionedBy, at:Date.now(),
              }),
            };
            if (startDate <= today) upd.status = 'on_leave';
            await staffSnap.docs[0].ref.update(upd);
          }

          if (config.channels.loaLog) {
            await postToChannel(client, config.channels.loaLog,
              `🗓️  **LOA Approved (portal)** — **${staffName}** | ${startDate} → ${endDate} | by ${actionedBy}`
            );
          }
        } catch (e) { log.error('loaRequests portal:', e.message); }

      } else if (change.type === 'added') {
        // New LOA request submitted — DM confirmation to staff
        const req = change.doc.data();
        if (!req.discordId) return;
        const text = config.messages.loaSubmitted({
          name: req.staffName, startDate: req.startDate,
          endDate: req.endDate, type: req.type,
        });
        await sendDM(client, db, req.discordId, text,
          `loa_submitted_${change.doc.id}`, `LOA submitted — ${req.staffName}`);
      }
    });
  }, err => log.error('loaRequests listener:', err));

  // ── Absence justification review ────────────────────────────────────────────
  db.collection('absenceJustifications').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type !== 'modified') return;
      const req = change.doc.data();
      if (!['approved','denied'].includes(req.status) || req.botDmSent) return;
      const { discordId, staffName, sessionTitle, status, reviewNote, reviewedBy } = req;
      if (!discordId) return;
      try {
        await change.doc.ref.update({ botDmSent: true });
        const actionedBy = reviewedBy || 'Valence HR';
        const text = config.messages.absenceReviewed({
          name: staffName, sessionTitle, status, reviewNote, actionedBy,
        });
        await sendDM(client, db, discordId, text, `abs_review_${change.doc.id}`,
          `Absence review — ${staffName}`, { addSig: true, actionedBy });
      } catch (e) { log.error('absenceJustifications listener:', e.message); }
    });
  }, err => log.error('absenceJustifications listener:', err));

  // ── Hub account provisioned ──────────────────────────────────────────────────
  db.collection('hubAccounts').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type !== 'added') return;
      const d = change.doc.data();
      if (!d.discordId || d.botWelcomeSent) return;
      try {
        await change.doc.ref.update({ botWelcomeSent: true });
        const text = config.messages.hubProvisioned({
          name: d.robloxUsername || d.discordUsername || 'Staff',
          hubLink: `https://valence-a6168.web.app/hub/?discord=${d.discordId}`,
        });
        await sendDM(client, db, d.discordId, text, `hub_prov_${d.discordId}`,
          `Hub provisioned — ${d.robloxUsername}`);
      } catch (e) { log.error('hubAccounts listener:', e.message); }
    });
  }, err => log.error('hubAccounts listener:', err));

  // ── Certificate issued ───────────────────────────────────────────────────────
  db.collection('certificates').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type !== 'added') return;
      const c = change.doc.data();
      if (!c.discordId || c.botDmSent) return;
      try {
        await change.doc.ref.update({ botDmSent: true });
        const text = config.messages.certificateIssued({
          name:       c.recipientName || c.discordUsername || 'Staff',
          certTitle:  c.templateData?.title || 'Certificate of Completion',
          moduleName: c.moduleName || '—',
          certId:     c.certId || c.id || '—',
        });
        await sendDM(client, db, c.discordId, text, `cert_issued_${c.id || change.doc.id}`,
          `Certificate — ${c.recipientName}`);
      } catch (e) { log.error('certificates listener:', e.message); }
    });
  }, err => log.error('certificates listener:', err));

  // ── LOA return reminder polling ──────────────────────────────────────────────
  async function checkLoaReminders() {
    const target  = new Date(Date.now() + config.reminders.loaEndReminderHours * 3600000);
    const dateStr = target.toISOString().slice(0, 10);
    try {
      const snap = await db.collection('staff')
        .where('loa.status','==','approved').where('loa.end','==',dateStr).get();
      for (const doc of snap.docs) {
        const d = doc.data();
        if (!d.discordId) continue;
        const text = config.messages.loaReturnReminder({
          name: d.rpName || d.robloxUsername || 'Staff', loaEnd: d.loa.end,
        });
        await sendDM(client, db, d.discordId, text,
          `loa_return_${doc.id}_${d.loa.end}`,
          `LOA return — ${d.rpName || d.robloxUsername}`);
      }
    } catch (e) { log.error('checkLoaReminders:', e.message); }
  }

  checkLoaReminders();
  setInterval(checkLoaReminders, config.reminders.pollingIntervalMs);
  log.info('👥  Staff listeners ready');
}

function _calcDuration(start, end) {
  if (!start || !end) return '—';
  try {
    const days = Math.round((new Date(end) - new Date(start)) / 86400000);
    return days === 1 ? '1 day' : `${days} days`;
  } catch { return '—'; }
}

module.exports = { startStaffListeners };
