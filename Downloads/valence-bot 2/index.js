/**
 * Valence Healthcare Discord Bot  v3.2
 * ─────────────────────────────────────────────────────────────────
 * Env vars (set in Railway / .env):
 *   DISCORD_TOKEN             — bot token from Discord Developer Portal
 *   FIREBASE_SERVICE_ACCOUNT  — full serviceAccount.json as a single JSON string
 *   FIREBASE_PROJECT_ID       — e.g. "valence-a6168"
 *   VERIFIED_ROLE_ID          — Discord role ID granted on captcha success
 *   PORT                      — health-check port (default 3000)
 */

require('dotenv').config();

const {
  Client, GatewayIntentBits, Partials,
  REST, Routes, Collection,
} = require('discord.js');
const admin  = require('firebase-admin');
const config = require('./config');
const log    = require('./src/log');

// ── Firebase init ─────────────────────────────────────────────────────────────
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : (() => { try { return require('./serviceAccount.json'); } catch { return null; } })();

if (!serviceAccount) {
  log.error('FATAL: No Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT env var.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId:  process.env.FIREBASE_PROJECT_ID || config.firebaseProjectId,
});
const db = admin.firestore();

// ── Discord client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

client.commands = new Collection();

// ── Load slash commands ───────────────────────────────────────────────────────
[
  './src/commands/strike',
  './src/commands/loa',
  './src/commands/staff',
  './src/commands/blacklist',
  './src/commands/leaderboard',
  './src/commands/attendance',
  './src/commands/directory',
  './src/commands/verify',
].forEach(f => {
  const cmd = require(f);
  client.commands.set(cmd.data.name, cmd);
});

// ── Register commands with Discord ────────────────────────────────────────────
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const body = client.commands.map(c => c.data.toJSON());
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, config.guildId), { body });
    log.info(`${body.length} slash commands registered`);
  } catch (e) {
    log.error('Command registration failed:', e.message);
  }
}

// ── Sync guild roles to Firestore ─────────────────────────────────────────────
async function syncGuildRoles() {
  try {
    const guild = await client.guilds.fetch(config.guildId);
    await guild.roles.fetch();
    const batch = db.batch();
    guild.roles.cache
      .filter(r => !r.managed && r.name !== '@everyone')
      .forEach(r => batch.set(
        db.collection('botGuildRoles').doc(r.id),
        { name: r.name, color: r.hexColor, position: r.position,
          syncedAt: admin.firestore.FieldValue.serverTimestamp() }
      ));
    await batch.commit();
    log.info(`${guild.roles.cache.size} roles synced to Firestore`);
  } catch (e) {
    log.error('syncGuildRoles:', e.message);
  }
}

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  log.info(`Valence Bot online — ${client.user.tag}`);

  await registerCommands();
  await syncGuildRoles();

  // Load runtime config from Firestore
  try {
    const cfg = await db.collection('settings').doc('roleConfig').get();
    if (cfg.exists) {
      const d = cfg.data();
      if (d.baseRole) config.positionRoles['*'] = [d.baseRole];
      if (d.positionRoles) {
        Object.entries(d.positionRoles).forEach(([pos, id]) => {
          config.positionRoles[pos] = [id];
        });
      }
      // Verified role: env var takes priority, then Firestore
      if (!config.verification?.verifiedRoleId && d.verifiedRoleId) {
        config.verification = { verifiedRoleId: d.verifiedRoleId };
      }
      log.info('Runtime role config loaded');
    }
  } catch (e) { log.warn('Could not load role config:', e.message); }

  // Override verified role from env if set
  if (process.env.VERIFIED_ROLE_ID) {
    config.verification = { verifiedRoleId: process.env.VERIFIED_ROLE_ID };
    log.info(`Verified role: ${process.env.VERIFIED_ROLE_ID}`);
  }

  // Start Firestore listeners
  require('./src/listeners/applications').startApplicationListeners(client, db);
  require('./src/listeners/sessions').startSessionListeners(client, db);
  require('./src/listeners/staff').startStaffListeners(client, db);
  require('./src/listeners/offerReply').startOfferReplyListener(client, db);

  log.info('All listeners active');
});

// ── Interaction handler ───────────────────────────────────────────────────────
const { handleVerification } = require('./src/listeners/verification');

client.on('interactionCreate', async interaction => {
  // Verification button
  if (interaction.isButton() && interaction.customId === 'verify_start') {
    await handleVerification(client, db, interaction).catch(e =>
      log.error('Verification button:', e.message)
    );
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction, client, db);
  } catch (e) {
    log.error(`/${interaction.commandName}:`, e.message);
    const msg = { content: 'An error occurred. Please try again.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

// ── Message handler ───────────────────────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (!message.guild) {
    // DM — could be a captcha response
    await handleVerification(client, db, message).catch(e =>
      log.error('Verification DM:', e.message)
    );
    return;
  }

  // Guild message tracking
  require('./src/messageTracker').trackMessage(db, message).catch(e =>
    log.warn('trackMessage:', e.message)
  );
});

// ── Member leave ──────────────────────────────────────────────────────────────
client.on('guildMemberRemove', member => {
  require('./src/listeners/memberLeave').handleMemberLeave(client, db, member)
    .catch(e => log.error('memberLeave:', e.message));
});

// ── Global error handling ─────────────────────────────────────────────────────
client.on('error', e => log.error('Discord error:', e.message));
process.on('unhandledRejection', e => log.error('Unhandled rejection:', e?.message || e));

client.login(process.env.DISCORD_TOKEN).catch(e => {
  log.error('Login failed:', e.message);
  process.exit(1);
});

// ── Health check ──────────────────────────────────────────────────────────────
require('http').createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, bot: client.user?.tag, ts: Date.now() }));
  } else {
    res.writeHead(404); res.end();
  }
}).listen(Number(process.env.PORT) || 3000, () =>
  log.info(`Health: :${process.env.PORT || 3000}/health`)
);

process.on('SIGTERM', () => { client.destroy(); process.exit(0); });
