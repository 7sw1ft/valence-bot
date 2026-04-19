# Valence Healthcare Bot v3

## GitHub + Railway Deployment Guide

### 1. Push to GitHub

```bash
# First time
git init
git add .
git commit -m "initial commit"
gh repo create valence-bot --private --push --source=.

# Future updates (from Railway or locally)
git add .
git commit -m "update: describe your change"
git push
```

### 2. Deploy on Railway (recommended)

1. Go to **railway.app** → New Project → **Deploy from GitHub repo**
2. Select your `valence-bot` repo
3. Under **Variables**, add:

| Key | Value |
|-----|-------|
| `DISCORD_TOKEN` | Your bot token from Discord Developer Portal |
| `FIREBASE_SERVICE_ACCOUNT` | Paste the full contents of `serviceAccount.json` as one line |
| `FIREBASE_PROJECT_ID` | `valence-a6168` |
| `PORT` | `3000` |

4. Railway auto-deploys on every `git push` to main ✅

### 3. Auto-deploy on every update

Once connected to GitHub, every `git push` triggers a redeploy automatically.
No manual steps needed — just push and Railway picks it up within ~30 seconds.

```bash
# Make a change, then:
git add .
git commit -m "fix: updated LOA messages"
git push
# Railway redeploys automatically
```

### 4. Environment variables reference

```env
DISCORD_TOKEN=your_bot_token_here
FIREBASE_PROJECT_ID=valence-a6168
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"valence-a6168",...}
PORT=3000
```

> **Note:** Never commit `.env` or `serviceAccount.json` — they are in `.gitignore`.

---

## What's new in this update

- **Portal LOA requests**: When a super admin approves a LOA submitted through the portal's Learning Hub tab, the bot automatically DMs the staff member and writes the LOA to their staff record.
- **Absence justification DMs**: When a portal admin approves or denies an absence justification, the staff member gets a DM notification automatically.
- No slash commands changed — all existing commands work the same.
