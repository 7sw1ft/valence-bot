# Valence Healthcare Bot  v3.2

## Quick Start

### 1 — Clone & install
```bash
git clone https://github.com/YOUR_ORG/valence-bot.git
cd valence-bot
npm install
cp .env.example .env   # fill in your credentials
node index.js
```

### 2 — Environment variables
Create a `.env` file (never commit it):

```
DISCORD_TOKEN=your_bot_token_here
FIREBASE_PROJECT_ID=valence-a6168
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"valence-a6168",...}
VERIFIED_ROLE_ID=123456789012345678
PORT=3000
```

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | From Discord Developer Portal → Bot → Reset Token |
| `FIREBASE_SERVICE_ACCOUNT` | Yes | Contents of `serviceAccount.json` as a single-line JSON string |
| `FIREBASE_PROJECT_ID` | Yes | `valence-a6168` |
| `VERIFIED_ROLE_ID` | Yes | Discord role ID granted after captcha verification |
| `PORT` | No | Health-check port, default `3000` |

---

## Deploy to Railway (recommended)

### First deploy
1. Go to **railway.app** → New Project → Deploy from GitHub repo
2. Select your `valence-bot` repository
3. Go to **Variables** tab and add all env vars from the table above
4. Railway auto-deploys on every push to `main`

### Update the bot
```bash
# Make your changes, then:
git add .
git commit -m "update: describe your change"
git push
# Railway redeploys automatically within ~30 seconds
```

---

## Push to GitHub (first time)

```bash
# Inside the valence-bot folder:
git init
git add .
git commit -m "initial commit"

# Create a private repo on github.com, then:
git remote add origin https://github.com/YOUR_ORG/valence-bot.git
git branch -M main
git push -u origin main
```

After this, every `git push` triggers a Railway redeploy automatically.

---

## Verification System

### Setup
1. Set `VERIFIED_ROLE_ID` env var to the Discord role ID you want to grant
2. Use `/verify` in any channel to post the verification panel
3. Users click **Begin Verification** → receive a DM captcha → enter code → get role

### How it works
- 6-character alphanumeric code (no ambiguous characters O/0/I/1)
- Code expires in 15 minutes
- 3 wrong attempts → 10-minute cooldown
- Success is logged to Firestore `verificationLog` collection

### Config (optional)
You can also set `verifiedRoleId` in Firestore at `settings/roleConfig.verifiedRoleId`
instead of using the env var.

---

## Slash Commands

| Command | Description |
|---|---|
| `/verify` | Post the verification panel in a channel |
| `/strike issue` | Issue a strike to a staff member |
| `/strike pardon` | Remove the latest strike |
| `/loa approve` | Approve a leave of absence |
| `/loa end` | End an LOA early |
| `/staff` | Staff management commands |
| `/blacklist` | Manage the blacklist |
| `/attendance` | Record session attendance |
| `/directory` | Staff directory commands |
| `/leaderboard` | View staff leaderboard |

---

## File Structure

```
valence-bot/
├── index.js              — Entry point, Discord client, event routing
├── config.js             — All configuration (messages, channels, roles)
├── .env                  — Secrets (not committed)
├── .env.example          — Template for .env
├── package.json
└── src/
    ├── log.js            — Logger
    ├── send.js           — DM utilities with deduplication
    ├── roles.js          — Role grant/revoke helpers
    ├── messageTracker.js — Guild message activity tracking
    ├── commands/
    │   ├── verify.js
    │   ├── strike.js
    │   ├── loa.js
    │   ├── staff.js
    │   ├── attendance.js
    │   ├── blacklist.js
    │   ├── directory.js
    │   └── leaderboard.js
    └── listeners/
        ├── verification.js   — Captcha DM flow
        ├── applications.js   — Application status changes
        ├── sessions.js       — Attendance DMs + reminders
        ├── staff.js          — LOA, strikes, promotions
        ├── offerReply.js     — Offer acceptance DM flow
        └── memberLeave.js    — Auto-terminate on server leave
```
