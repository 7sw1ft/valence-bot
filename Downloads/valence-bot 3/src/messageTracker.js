const admin = require('firebase-admin');
const log   = require('./log');

// Reset daily at midnight UTC, weekly on Monday UTC
function todayKey()  { return new Date().toISOString().slice(0, 10); }
function weekKey()   {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  return mon.toISOString().slice(0, 10);
}

// Batch writes to avoid hammering Firestore
const _pending = new Map();
let _flushTimer = null;

async function trackMessage(db, message) {
  const discordId = message.author.id;

  if (!_pending.has(discordId)) {
    _pending.set(discordId, {
      discordId,
      discordUsername: message.author.username,
      displayName:     message.member?.displayName || message.author.username,
      avatarHash:      message.author.avatar || '',
      count: 0,
    });
  }
  _pending.get(discordId).count++;

  // Flush every 30 seconds
  if (!_flushTimer) {
    _flushTimer = setTimeout(() => flush(db), 30_000);
  }
}

async function flush(db) {
  _flushTimer = null;
  if (!_pending.size) return;

  const entries = [..._pending.entries()];
  _pending.clear();

  const today = todayKey();
  const week  = weekKey();

  const batch = db.batch();

  for (const [discordId, data] of entries) {
    const ref = db.collection('messageTracking').doc(discordId);
    batch.set(ref, {
      discordId,
      discordUsername: data.discordUsername,
      displayName:     data.displayName,
      avatarHash:      data.avatarHash,
      dailyCount:      admin.firestore.FieldValue.increment(data.count),
      weeklyCount:     admin.firestore.FieldValue.increment(data.count),
      allTimeCount:    admin.firestore.FieldValue.increment(data.count),
      lastDay:         today,
      lastWeek:        week,
      lastMessage:     admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  try {
    await batch.commit();
  } catch (e) {
    log.warn('messageTracker flush failed:', e.message);
  }
}

// Reset daily/weekly counters — call this at midnight / week start
async function resetCounters(db) {
  const today = todayKey();
  const week  = weekKey();

  const snap = await db.collection('messageTracking').get();
  const batch = db.batch();
  let ops = 0;

  snap.forEach(doc => {
    const d = doc.data();
    const updates = {};
    if (d.lastDay !== today)   updates.dailyCount  = 0;
    if (d.lastWeek !== week)   updates.weeklyCount = 0;
    if (Object.keys(updates).length) {
      if (d.lastDay !== today)  updates.lastDay  = today;
      if (d.lastWeek !== week)  updates.lastWeek = week;
      batch.update(doc.ref, updates);
      ops++;
    }
  });

  if (ops) {
    await batch.commit();
    log.info(`🔄 Reset ${ops} message counters`);
  }
}

module.exports = { trackMessage, resetCounters };
