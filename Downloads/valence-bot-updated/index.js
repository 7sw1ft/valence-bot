/**
 * Valence Healthcare Discord Bot  v3
 * ─────────────────────────────────────────────────────────────────
 * Env vars:
 *   DISCORD_TOKEN             — bot token
 *   FIREBASE_SERVICE_ACCOUNT  — serviceAccount.json contents as JSON string
 *   FIREBASE_PROJECT_ID       — optional, defaults to config value
 */

require('dotenv').config();

const {
  Client, GatewayIntentBits, Partials,
  REST, Routes, Collection
} = require('discord.js');
const admin  = require('firebase-admin');
const config = require('./config');
const log    = require('./src/log');

// ── Firebase ──────────────────────────────────────────────────────────────────
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : (() => { try { return require('./serviceAccount.json'); } catch { return null; } })();

if (!serviceAccount) { log.error('No Firebase credentials'); process.exit(1); }

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId:  process.env.FIREBASE_PROJECT_ID || config.firebaseProjectId,
});
const db = admin.firestore();

// ── Discord ───────────────────────────────────────────────────────────────────
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

// ── Load commands ─────────────────────────────────────────────────────────────
const commandFiles = [
  './src/commands/strike',
  './src/commands/loa',
  './src/commands/staff',
  './src/commands/blacklist',
  './src/commands/leaderboard',
  './src/commands/attendance',
  './src/commands/directory',
];

commandFiles.forEach(f => {
  const cmd = require(f);
  client.commands.set(cmd.data.name, cmd);
});

// ── Register slash commands ───────────────────────────────────────────────────
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const body = client.commands.map(c => c.data.toJSON());
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, config.guildId),
      { body }
    );
    log.info(`✅  ${body.length} slash commands registered`);
  } catch (e) {
    log.error('Command registration failed:', e.message);
  }
}

// ── Sync Discord roles to Firestore ──────────────────────────────────────────
async function syncGuildRoles() {
  try {
    const guild = await client.guilds.fetch(config.guildId);
    await guild.roles.fetch();
    const batch = db.batch();
    guild.roles.cache
      .filter(r => !r.managed && r.name !== '@everyone')
      .forEach(r => {
        batch.set(db.collection('botGuildRoles').doc(r.id), {
          name:     r.name,
          color:    r.hexColor,
          position: r.position,
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    await batch.commit();
    log.info(`🎖️  ${guild.roles.cache.size} roles synced to Firestore`);
  } catch (e) {
    log.error('syncGuildRoles failed:', e.message);
  }
}

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  log.info(`✅  Valence Bot online → ${client.user.tag}`);

  await registerCommands();
  await syncGuildRoles();

  // Load role config from Firestore and update config.positionRoles at runtime
  try {
    const cfg = await db.collection('settings').doc('roleConfig').get();
    if (cfg.exists) {
      const d = cfg.data();
      if (d.baseRole) config.positionRoles['*'] = [d.baseRole];
      if (d.positionRoles) {
        Object.entries(d.positionRoles).forEach(([pos, roleId]) => {
          config.positionRoles[pos] = [roleId];
        });
      }
      log.info('🎖️  Role config loaded from Firestore');
    }
  } catch (e) { log.warn('Could not load role config:', e.message); }

  // Start listeners
  const { startApplicationListeners } = require('./src/listeners/applications');
  const { startSessionListeners }     = require('./src/listeners/sessions');
  const { startStaffListeners }       = require('./src/listeners/staff');
  const { startOfferReplyListener }   = require('./src/listeners/offerReply');

  startApplicationListeners(client, db);
  startSessionListeners(client, db);
  startStaffListeners(client, db);
  startOfferReplyListener(client, db);

  log.info('📡  All listeners active');
});

// ── Slash command handler ─────────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction, client, db);
  } catch (e) {
    log.error(`Command ${interaction.commandName} error:`, e.message);
    const msg = { content: '❌ An error occurred.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

// ── Message tracking ──────────────────────────────────────────────────────────
const { trackMessage } = require('./src/messageTracker');
client.on('messageCreate', message => {
  if (message.author.bot || !message.guild) return;
  trackMessage(db, message).catch(e => log.warn('trackMessage:', e.message));
});

// ── Auto-terminate: member leaves server ─────────────────────────────────────
const { handleMemberLeave } = require('./src/listeners/memberLeave');
client.on('guildMemberRemove', member => {
  handleMemberLeave(client, db, member).catch(e => log.error('memberLeave:', e.message));
});

// ── Error handling ────────────────────────────────────────────────────────────
client.on('error', e => log.error('Discord error:', e.message));

client.login(process.env.DISCORD_TOKEN).catch(e => {
  log.error('Login failed:', e.message);
  process.exit(1);
});

// ── Health server ─────────────────────────────────────────────────────────────
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ts: Date.now() }));
  } else { res.writeHead(404); res.end(); }
}).listen(PORT, () => log.info(`🌐  Health → :${PORT}/health`));

process.on('SIGTERM', () => { client.destroy(); process.exit(0); });
