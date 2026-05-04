const config   = require('../../config');
const { sendDM } = require('../send');
const log      = require('../log');

const _prevLoa     = new Map();
const _prevStrikes = new Map();

function startStaffListeners(client, db) {

  db.collection('staff').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'removed') return;
      const uid  = change.doc.id;
      const data = change.doc.data();
      const did  = data.discordId;
      const name = data.rpName || data.robloxUsername || 'Staff Member';

      // LOA
      const loa     = data.loa;
      const prevLoa = _prevLoa.get(uid);
      if (loa && did && loa.status === 'approved' && prevLoa?.status !== 'approved') {
        const duration = _calcDuration(loa.start, loa.end);
        const text = config.messages.loaApproved({
          name, loaStart: loa.start || '—', loaEnd: loa.end || '—', loaDuration: duration,
        });
        await sendDM(client, db, did, text, `loa_approved_${uid}_${loa.start}`, `LOA — ${name}`);
      }
      if (loa) _prevLoa.set(uid, { ...loa });

      // Strikes
      const strikes     = data.strikes || [];
      const prevStrikes = _prevStrikes.get(uid) || [];
      if (strikes.length > prevStrikes.length && did) {
        const latest = strikes[strikes.length - 1];
        const text = config.messages.strikeIssued({
          name, reason: latest?.reason || '—',
          strikeLevel: latest?.level || strikes.length,
          strikeCount: strikes.length,
        });
        await sendDM(client, db, did, text, `strike_${uid}_${strikes.length}`, `Strike — ${name}`);
      }
      _prevStrikes.set(uid, [...strikes]);
    });
  }, err => log.error('staff listener:', err));

  // LOA return reminder
  async function checkLoaReminders() {
    const target  = new Date(Date.now() + config.reminders.loaEndReminderHours * 3600000);
    const dateStr = target.toISOString().slice(0, 10);
    try {
      const snap = await db.collection('staff')
        .where('loa.status', '==', 'approved').where('loa.end', '==', dateStr).get();
      for (const doc of snap.docs) {
        const d = doc.data();
        if (!d.discordId) continue;
        const text = config.messages.loaReturnReminder({
          name: d.rpName || d.robloxUsername || 'Staff', loaEnd: d.loa.end,
        });
        await sendDM(client, db, d.discordId, text,
          `loa_return_${doc.id}_${d.loa.end}`, `LOA return — ${d.rpName || d.robloxUsername}`);
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
