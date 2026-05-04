/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║         VALENCE HEALTHCARE — BOT CONFIGURATION                   ║
 * ║  Edit THIS file only. Never touch src/ to change messages/IDs.  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

module.exports = {

  // ─── DISCORD SERVER ────────────────────────────────────────────────────────
  guildId: '1438557595014135890',   // Right-click server → Copy Server ID

  // ─── FIREBASE ──────────────────────────────────────────────────────────────
  firebaseProjectId: 'valence-a6168',

  // ─── PORTAL LINK ───────────────────────────────────────────────────────────
  // Link sent after offer acceptance. Can be overridden per-application
  // by setting `portalLink` on the Firestore application document.
  defaultPortalLink: 'https://valence-a6168.web.app/vhc-secure-portal/',

  // ─── SIGNATURE (appears at bottom of formal DMs) ───────────────────────────
  signature: {
    name: 'MyValenceStaffing.net',   // e.g. "Jane Doe" or "HR Department"
    role: 'Human Resources Department Automations',
  },

  // ─── FOOTER (appended to every DM) ─────────────────────────────────────────
  footer: '<:valencelogo:1474467443824005323> **[Valence Healthcare](https://cdn.discordapp.com/attachments/1438557995154800825/1474462525218357288/C9.png?ex=6999efbc&is=69989e3c&hm=d8afac96fb354ca8c208fa1dd82f51afcb1a606148aaa76b9988ebfb35788211&)**',

  // ─── CHANNELS ──────────────────────────────────────────────────────────────
  channels: {
    applicationsLog: '1474474906065305771',  // #applications-log  — new app embeds
    staffAlerts:     '1492584505054073022',  // #staff-alerts      — DM fallback
    rankerPing:      '1492584317187260627',  // #ranker-requests   — ping to rank in Roblox
    loaLog:          '1492584586591469741',  // #loa-log           — optional LOA log
  },

  // ─── ROLES PER POSITION ─────────────────────────────────────────────────────
  // Discord role IDs granted automatically when application reaches "hired".
  // '*' = given to EVERYONE regardless of position (e.g. a "Staff" base role).
  // Add as many positions as needed. Key must match exactly the `position`
  // field in Firestore (case-sensitive).
  positionRoles: {
    '*':           ['1492584745731752026'],   // base staff role — always given
    'Attending Physician':   ['1492584879924183212'],
    'Patient Access Representative':      ['1492584971523850393'],
    // Add more positions here ↓
  },

  // ─── REMINDER TIMING ───────────────────────────────────────────────────────
  reminders: {
    sessionReminderHours: 24,      // DM host N hours before session
    loaEndReminderHours:  24,      // DM staff N hours before LOA ends
    pollingIntervalMs:    3600000, // how often to check (ms) — default 1 hour
  },

  // ─── RESTART GUARD ─────────────────────────────────────────────────────────
  // Skip Firestore events older than N minutes on bot restart
  restartGuardMinutes: 5,

  // ═══════════════════════════════════════════════════════════════════════════
  //  MESSAGES
  //  Each message is a function that receives variables and returns a string.
  //  Variables available: name, position, loaStart, loaEnd, loaDuration,
  //                       sessionTitle, sessionDate, sessionTime, host,
  //                       reason, strikeCount, portalLink
  //
  //  {footer} is automatically appended. Do NOT add it manually.
  // ═══════════════════════════════════════════════════════════════════════════
  messages: {

    // ── 1. OFFER EXTENDED (sent when status → accepted) ─────────────────────
    offerExtended: ({ name, position, signature }) =>
      `Dear **${name}** ,\n` +
      `After a thorough review of your profile and application, we are pleased to extend an official offer for the position of **${position}** within Valence Healthcare.\n` +
      `We believe your expertise aligns with our mission to set a new gold standard in ro-medicine, leaving past issues behind and focusing on professional excellence.\n\n` +
      `Please respond to this DM to confirm your acceptance of this offer. Once you confirm, we will provide the link to our portal to complete your official onboarding.\n\n` +
      `Thank you,\n` +
      `***${signature.name}***\n` +
      `${signature.role}`,

    // ── 2. PORTAL LINK (sent after applicant replies to the offer) ──────────
    portalLink: ({ portalLink }) =>
      `Thank you for accepting the offer. To ensure a stable, professional, and toxicity-free environment, the final step is to complete your basic orientation and sign our Official Agreement (NDA & Code of Conduct).\n` +
      `This process is handled exclusively through our platform. Access to your rank and internal channels will remain restricted until your signature is verified by the system.\n\n` +
      `<:valence_link:1474465218250936384>  [Employement Portal](${portalLink})\n`,

    // ── 3. HIRED / AGREEMENT VERIFIED (sent when status → hired) ────────────
    hired: ({ name, position, signature }) =>
      `Your signature has been verified. You are now Officially Hired as an active member of Valence Healthcare.\n` +
      `Your personnel record is now Active and your ranks permissions have been granted. Welcome to the team, let's build the future of medical excellence together.\n` +
      `If you have any further questions regarding your employement, please open a Human Resources Ticket.\n\n` +
      `Thank you,\n` +
      `***${signature.name}***\n` +
      `${signature.role}`,

    // ── 4. REJECTION ─────────────────────────────────────────────────────────
    rejected: ({ name, position, signature }) =>
      `Dear, **${name}**\n` +
      `After a careful review of your application, we regret to inform you that we have decided not to move forward with your application for **${position}** at this time. Please note that this decision was made after a thorough evaluation of many highly qualified candidates.\n\n` +
      `We wish you the very best of luck with your current job search and your future professional endeavours.\n\n` +
      `Thank you,\n` +
      `***${signature.name}***\n` +
      `${signature.role}`,

    // ── 5. TERMINATION ───────────────────────────────────────────────────────
    terminated: ({ name, signature }) =>
      `Dear **${name}**,\n` +
      `We are writing to formally notify you that your position within the Valence staff team has been terminated, effective immediately.\n\n` +
      `This decision follows a recent internal review of your conduct and contributions. We have determined that your current standing no longer aligns with the professional standards and core values we require from our staff members.\n\n` +
      `Please note the following:\n` +
      `> **Access:** All administrative privileges and internal permissions have been revoked.\n` +
      `> **Confidentiality:** You remain bound by our non-disclosure expectations regarding internal protocols and staff-only information.\n` +
      `> **Finality:** This decision is final and represents a permanent separation from the team.\n\n` +
      `We appreciate the time you have dedicated to Valence and wish you the best in your future endeavours.\n\n` +
      `Regards,\n` +
      `***${signature.name}***\n` +
      `${signature.role}`,

    // ── 5b. TERMINATION REASON (second message, sent if reason provided) ─────
    terminationReason: ({ reason }) =>
      `**Reason for Termination:**\n> ${reason}`,

    // ── 6. LOA APPROVED ──────────────────────────────────────────────────────
    loaApproved: ({ name, loaStart, loaEnd, loaDuration }) =>
      `Dear, **${name}**\n` +
      `We are pleased to inform you that your request for a Leave of Absence (LOA) has been successfully processed into our database and approved.\n\n` +
      `<:valence_schedule:1474480738161393766> **Start Date:** ${loaStart}\n` +
      `<:valence_schedule:1474480738161393766> **End Date:** ${loaEnd}\n` +
      `<:valence_schedule:1474480738161393766> **Total Duration:** ${loaDuration}\n\n` +
      `We understand the importance of taking time away to recharge or attend to personal matters, and we fully support your decision to step back temporarily.\n\n` +
      `We'll make sure to inform you whenever your leave of absence is close to concluding.\n\n` +
      `Thank You,`,

    // ── 7. LOA RETURN REMINDER (sent 24 h before LOA ends) ──────────────────
    loaReturnReminder: ({ name, loaEnd }) =>
      `Hi **${name}**,\n` +
      `This is a reminder that your **Leave of Absence** concludes on **${loaEnd}**.\n\n` +
      `> Your return is expected within **24 hours**. Please make sure you are ready to resume your duties.\n` +
      `> If you need an extension, contact HR as soon as possible.\n\n` +
      `We look forward to having you back on the team!`,

    // ── 8. SESSION — PRESENT ─────────────────────────────────────────────────
    sessionPresent: ({ name, sessionTitle, sessionDate }) =>
      `Greetings **${name}**,\n` +
      `Your attendance has been **confirmed** for the following session:\n\n` +
      `> <:valence_heart:1474481603089535057> **${sessionTitle}**\n` +
      `> <:valence_schedule:1474480738161393766> ${sessionDate}\n\n` +
      `Thank you for attending. Your dedication to the team is noted.`,

    // ── 9. SESSION — ABSENT ──────────────────────────────────────────────────
    sessionAbsent: ({ name, sessionTitle, sessionDate, host }) =>
      `Greetings **${name}**,\n` +
      `You were marked **absent** in the following session:\n\n` +
      `> <:valence_heart:1474481603089535057> **${sessionTitle}**\n` +
      `> <:valence_schedule:1474480738161393766> ${sessionDate}\n` +
      `> <:hr:1474484070514950324> **Host:** ${host}\n\n` +
      `If this was an error or you were excused (LOA), please contact **${host}** or open an HR ticket within **24 hours**.`,

    // ── 10. SESSION REMINDER (to host, 24 h before) ──────────────────────────
    sessionReminder: ({ name, sessionTitle, sessionDate, sessionTime }) =>
      `Greetings **${name}**,\n` +
      `This is a reminder that you are hosting a session tomorrow:\n\n` +
      `> <:valence_heart:1474481603089535057> **${sessionTitle}**\n` +
      `> <:valence_schedule:1474480738161393766> ${sessionDate} at **${sessionTime} EST**\n\n` +
      `Please be ready **30 minutes early** and ensure your server is set up.`,

    // ── 0. APPLICATION RECEIVED (sent when new application submitted) ─────────
    applicationReceived: ({ name, position }) =>
      `Hi **${name}**! 👋\n` +
      `We've received your application for **${position}** at Valence Healthcare.\n\n` +
      `Our team will review your application and get back to you as soon as possible. ` +
      `Please make sure your Discord DMs are open so we can reach you with our decision.\n\n` +
      `Thank you for your interest in joining Valence Healthcare.`,

    // ── 11. RANKER PING (posted to ranker channel) ───────────────────────────
    rankerPing: ({ name, robloxUsername, position, discordId }) =>
      `<:valence_mission:1474448341734658261> **Rank Request**\n` +
      `> **Name:** ${name}\n` +
      `> **Roblox Username:** ${robloxUsername}\n` +
      `> **Position:** ${position}\n` +
      `> **Discord:** <@${discordId}>\n\n` +
      `Please rank this member in the Roblox group as soon as possible.`
      +`
<@&1492585969101045971>`,


    // ── 12. STRIKE ISSUED (from /strike command or portal) ──────────────────
    strikeIssued: ({ name, reason, strikeLevel, strikeCount }) =>
      `Hi **${name}**,\n` +
      `A **Strike ${strikeLevel}** has been issued to your record.\n\n` +
      `> **Reason:** ${reason}\n` +
      `> **Total Strikes:** ${strikeCount}\n\n` +
      `Please review the Staff Handbook. Further violations may result in termination.\n` +
      `If you believe this is an error, open an HR ticket within **48 hours**.`,

  },

  // ─── COMMAND ROLE REQUIREMENTS ─────────────────────────────────────────────
  // Map of command name → array of role IDs that can use it.
  // Users with ANY of the listed roles can run the command.
  // Empty array = no role restriction (anyone can use).
  // Set these to your actual Discord role IDs.
  commandRoles: {
    strike:      [process.env.ROLE_HR      || '1443343977670770730'],   // HR / Senior Staff
    loa:         [process.env.ROLE_HR      || '1443343977670770730'],
    staff:       [process.env.ROLE_HR      || '1443343977670770730'],
    blacklist:   [process.env.ROLE_ADMIN   || '1443343977670770730'],
    attendance:  [process.env.ROLE_HOST    || '1443343977670770730'],
    directory:   [process.env.ROLE_STAFF   || '1443343977670770730'],
    leaderboard: [],                                  // anyone
    verify:      [process.env.ROLE_ADMIN   || '1443343977670770730'],
  },

  // ─── VERIFICATION ──────────────────────────────────────────────────────────
  // verifiedRoleId: set via VERIFIED_ROLE_ID env var or Firestore settings/roleConfig
  verification: {
    verifiedRoleId: process.env.VERIFIED_ROLE_ID || '1474108375422865468',
  },

  // ─── SIGNATURE HELPER ──────────────────────────────────────────────────────
  sig(actionedBy) {
    const by = actionedBy || 'Valence Automation System';
    return `\n\n\u2014\n${this.signature.name}  ·  ${this.signature.role}\nActioned by: ${by}`;
  },

};
