const config = require('../../config');
const { sendDM } = require('../send');
const log    = require('../log');

const _prevAtt     = new Map();
const _prevAbs     = new Map();
const _prevStatus  = new Map();

function startSessionListeners(client, db) {

  db.collection('sessions').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'removed') return;
      const id = change.doc.id;
      const s  = change.doc.data();

      // ── Attendance DMs ────────────────────────────────────────────────────────
      const curAtt  = s.botAttendees || [];
      const curAbs  = s.botAbsentees || [];
      const prevAtt = _prevAtt.get(id) || [];
      const prevAbs = _prevAbs.get(id) || [];

      const newAtt = curAtt.filter(a => !prevAtt.some(p => p.discordId === a.discordId));
      const newAbs = curAbs.filter(a => !prevAbs.some(p => p.discordId === a.discordId));

      for (const p of newAtt) {
        const text = config.messages.sessionPresent({
          name: p.name, sessionTitle: s.title, sessionDate: s.date, host: s.host,
        });
        await sendDM(client, db, p.discordId, text,
          `present_${id}_${p.discordId}`, `Present — ${s.title}`);
      }
      for (const p of newAbs) {
        const text = config.messages.sessionAbsent({
          name: p.name, sessionTitle: s.title, sessionDate: s.date, host: s.host,
        });
        await sendDM(client, db, p.discordId, text,
          `absent_${id}_${p.discordId}`, `Absent — ${s.title}`);
      }

      _prevAtt.set(id, [...curAtt]);
      _prevAbs.set(id, [...curAbs]);

      // ── Session completed → DM host with summary ───────────────────────────────
      const prevStat = _prevStatus.get(id);
      if (s.status === 'completed' && prevStat && prevStat !== 'completed' && s.attendanceRecorded) {
        const attendees = s.attendees || [];
        const present   = attendees.filter(a => a.status === 'present').length;
        const absent    = attendees.filter(a => a.status === 'absent').length;

        // Find host's Discord ID
        if (s.host) {
          const staffSnap = await db.collection('staff')
            .where('robloxUsername', '==', s.host).limit(1).get();
          if (!staffSnap.empty) {
            const hostData = staffSnap.docs[0].data();
            if (hostData.discordId) {
              const text = config.messages.sessionCompleted({
                name:         hostData.rpName || s.host,
                sessionTitle: s.title,
                sessionDate:  s.date,
                presentCount: present,
                absentCount:  absent,
              });
              await sendDM(client, db, hostData.discordId, text,
                `sess_complete_${id}`, `Session complete — ${s.title}`);
            }
          }
        }
      }
      _prevStatus.set(id, s.status);
    });
  }, err => log.error('sessions listener:', err));

  // ── 24 h session reminder to host ─────────────────────────────────────────────
  async function checkReminders() {
    const target  = new Date(Date.now() + config.reminders.sessionReminderHours * 3600000);
    const dateStr = target.toISOString().slice(0, 10);
    try {
      const snap = await db.collection('sessions')
        .where('date', '==', dateStr).where('status', '==', 'upcoming').get();
      for (const doc of snap.docs) {
        const s = doc.data();
        const staffSnap = await db.collection('staff')
          .where('robloxUsername', '==', s.host).limit(1).get();
        if (staffSnap.empty) continue;
        const staff = staffSnap.docs[0].data();
        if (!staff.discordId) continue;
        const text = config.messages.sessionReminder({
          name:         staff.rpName || staff.robloxUsername || s.host,
          sessionTitle: s.title,
          sessionDate:  s.date,
          sessionTime:  s.time || 'TBD',
        });
        await sendDM(client, db, staff.discordId, text,
          `sess_reminder_${doc.id}`, `Reminder — ${s.title}`);
      }
    } catch (e) { log.error('checkReminders:', e.message); }
  }

  checkReminders();
  setInterval(checkReminders, config.reminders.pollingIntervalMs);
  log.info('📅  Session listeners ready');
}

module.exports = { startSessionListeners };
