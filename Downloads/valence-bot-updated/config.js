/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║         VALENCE HEALTHCARE — BOT CONFIGURATION  v3.1            ║
 * ║  Edit THIS file only. Never touch src/ to change messages/IDs.  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

module.exports = {

  // ─── DISCORD SERVER ────────────────────────────────────────────────────────
  guildId: '1438557595014135890',

  // ─── FIREBASE ──────────────────────────────────────────────────────────────
  firebaseProjectId: 'valence-a6168',

  // ─── PORTAL LINK ───────────────────────────────────────────────────────────
  defaultPortalLink: 'https://valence-a6168.web.app/vhc-secure-portal/',

  // ─── ORGANISATION INFO ─────────────────────────────────────────────────────
  org: {
    name:    'Valence Healthcare',
    short:   'Valence',
    website: 'valence-a6168.web.app',
    dept:    'Human Resources Department',
  },

  // ─── CHANNELS ──────────────────────────────────────────────────────────────
  channels: {
    applicationsLog: '1474474906065305771',
    staffAlerts:     '1492584505054073022',
    rankerPing:      '1492584317187260627',
    loaLog:          '1492584586591469741',
    staffUpdates:    '1492584505054073022', // channel for promotions, awards, etc.
  },

  // ─── ROLES PER POSITION ────────────────────────────────────────────────────
  positionRoles: {
    '*':                           ['1492584745731752026'],
    'Attending Physician':         ['1492584879924183212'],
    'Patient Access Representative': ['1492584971523850393'],
  },

  // ─── REMINDER TIMING ───────────────────────────────────────────────────────
  reminders: {
    sessionReminderHours: 24,
    loaEndReminderHours:  24,
    pollingIntervalMs:    3600000,
  },

  // ─── RESTART GUARD ─────────────────────────────────────────────────────────
  restartGuardMinutes: 5,

  // ─── FOOTER ────────────────────────────────────────────────────────────────
  footer: '<:valencelogo:1474467443824005323> **[Valence Healthcare](https://cdn.discordapp.com/attachments/1438557995154800825/1474462525218357288/C9.png)**',

  // ═══════════════════════════════════════════════════════════════════════════
  //  SIGNATURE BUILDER
  //  actionedBy = name of admin/bot who performed the action
  //  dept       = department label (optional override)
  // ═══════════════════════════════════════════════════════════════════════════
  sig(actionedBy, dept) {
    const by   = actionedBy || 'MyValenceEmployement.net';
    const unit = dept || this.org.dept;
    return (
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `****${by}**\n` +
      `**${this.org.name}** · ${unit}**`
    );
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  MESSAGES
  //  All functions receive { name, position, actionedBy, ... }
  //  actionedBy = name of the portal admin / bot / system that took the action
  // ═══════════════════════════════════════════════════════════════════════════
  messages: {

    // ── APPLICATION RECEIVED ─────────────────────────────────────────────────
    applicationReceived: ({ name, position }) =>
      `## Application Received\n` +
      `Hi **${name}**,\n\n` +
      `We've successfully received your application for **${position}** at Valence Healthcare.\n\n` +
      `> 🕐 **Status:** Under Review\n` +
      `> 📬 **Next step:** Our team will reach out via this DM with our decision.\n\n` +
      `Please keep your DMs open and check back regularly. We appreciate your interest in joining our team.`,

    // ── OFFER EXTENDED ───────────────────────────────────────────────────────
    offerExtended: ({ name, position, actionedBy }) =>
      `## Official Offer — ${position}\n` +
      `Dear **${name}**,\n\n` +
      `After a thorough review of your application and credentials, we are pleased to extend you an **official offer** for the position of:\n\n` +
      `> 🏥 **Position:** ${position}\n` +
      `> 🏢 **Organisation:** Valence Healthcare\n\n` +
      `We believe your profile aligns with our mission to set a new gold standard in ro-medicine.\n\n` +
      `**Please reply to this message** to confirm your acceptance. Once confirmed, you will receive your onboarding portal link.\n\n` +
      `We look forward to hearing from you.`,

    // ── PORTAL LINK ──────────────────────────────────────────────────────────
    portalLink: ({ portalLink }) =>
      `## Onboarding Portal Access\n` +
      `Thank you for accepting. Your next step is to complete the onboarding process through our secure portal.\n\n` +
      `> 📋 Complete your **Staff Orientation**\n` +
      `> ✍️  Sign the **Code of Conduct**\n` +
      `> 🎖️  Receive your **Discord roles** upon completion\n\n` +
      `Access to internal channels and your Roblox rank will remain restricted until your signature is verified by the system.\n\n` +
      `<:valence_link:1474465218250936384> **[Access Your Onboarding Portal](${portalLink})**`,

    // ── HIRED ────────────────────────────────────────────────────────────────
    hired: ({ name, position, actionedBy }) =>
      `## Welcome to the Team — Officially Hired\n` +
      `Dear **${name}**,\n\n` +
      `Your signature has been **verified** and your onboarding is now complete. You are officially an active member of Valence Healthcare.\n\n` +
      `> 🎖️  **Position:** ${position}\n` +
      `> 📂 **Personnel Record:** Active\n` +
      `> 🔓 **Access:** Roles and permissions have been granted\n\n` +
      `Welcome to the team. If you have any questions regarding your employment, please open a Human Resources ticket.\n`,

    // ── REJECTED ─────────────────────────────────────────────────────────────
    rejected: ({ name, position, actionedBy }) =>
      `## Application Decision — ${position}\n` +
      `Dear **${name}**,\n\n` +
      `After careful review, we regret to inform you that we have decided **not to move forward** with your application for **${position}** at this time.\n\n` +
      `> This decision was made following a thorough evaluation of all candidates.\n` +
      `> You are welcome to reapply in the future should positions become available.\n\n` +
      `We sincerely thank you for your interest in Valence Healthcare and wish you the very best in your future endeavours.`,

    // ── TERMINATION ──────────────────────────────────────────────────────────
    terminated: ({ name, actionedBy }) =>
      `## Employment Termination Notice\n` +
      `Dear **${name}**,\n\n` +
      `We are writing to formally notify you that your position within the **Valence Healthcare** staff team has been **terminated, effective immediately**.\n\n` +
      `> 🔒 **Access:** All administrative privileges and internal permissions have been revoked\n` +
      `> 📋 **Confidentiality:** You remain bound by our non-disclosure expectations\n` +
      `> ⚠️  **Finality:** This decision is final and represents a permanent separation\n\n` +
      `We appreciate the time you dedicated to Valence and wish you well in your future endeavours.`,

    // ── TERMINATION REASON ───────────────────────────────────────────────────
    terminationReason: ({ reason }) =>
      `> **📌 Reason for Termination:**\n> ${reason}`,

    // ── PROMOTION ────────────────────────────────────────────────────────────
    promoted: ({ name, oldPosition, newPosition, actionedBy }) =>
      `## Promotion — ${newPosition}\n` +
      `Congratulations **${name}**,\n\n` +
      `We are pleased to announce that, following a review of your performance and contributions, you have been **promoted**.\n\n` +
      `> ⬆️  **Previous Position:** ${oldPosition || '—'}\n` +
      `> 🏅 **New Position:** ${newPosition}\n\n` +
      `Your new rank and permissions have been updated in the system. We look forward to your continued excellence at Valence Healthcare.\n`,

    // ── DEMOTION ─────────────────────────────────────────────────────────────
    demoted: ({ name, oldPosition, newPosition, actionedBy }) =>
      `## Position Update — ${newPosition}\n` +
      `Dear **${name}**,\n\n` +
      `Following a review, your position within Valence Healthcare has been **updated**.\n\n` +
      `> **Previous Position:** ${oldPosition || '—'}\n` +
      `> **New Position:** ${newPosition}\n\n` +
      `If you have questions regarding this change, please open an HR ticket.`,

    // ── AWARD ────────────────────────────────────────────────────────────────
    awardReceived: ({ name, awardTitle, awardDesc, actionedBy }) =>
      `## Award — ${awardTitle}\n` +
      `Congratulations **${name}**,\n\n` +
      `We are pleased to recognise your outstanding contribution to Valence Healthcare with the following award:\n\n` +
      `> 🏅 **Award:** ${awardTitle}\n` +
      (awardDesc ? `> 📝 **Details:** ${awardDesc}\n` : '') +
      `\nThis recognition has been added to your permanent personnel record. Thank you for your dedication and excellence.`,

    // ── STRIKE ISSUED ────────────────────────────────────────────────────────
    strikeIssued: ({ name, reason, strikeLevel, strikeCount, actionedBy }) =>
      `## Strike ${strikeLevel} — Formal Notice\n` +
      `Hi **${name}**,\n\n` +
      `A formal **Strike ${strikeLevel}** has been issued to your personnel record.\n\n` +
      `> 📌 **Reason:** ${reason}\n` +
      `> 🔢 **Total Strikes on Record:** ${strikeCount}\n` +
      `> ⚠️  **Warning:** Accumulation of 3 strikes may result in disciplinary review or termination\n\n` +
      `Please review the Staff Handbook and ensure your conduct meets the standards expected at Valence Healthcare.\n` +
      `If you believe this was issued in error, open an **HR ticket within 48 hours**.`,

    // ── STRIKE PARDONED ──────────────────────────────────────────────────────
    strikePardoned: ({ name, reason, strikeCount, actionedBy }) =>
      `## Strike Pardoned\n` +
      `Hi **${name}**,\n\n` +
      `Following a review, a strike has been **removed** from your personnel record.\n\n` +
      `> 📌 **Reason:** ${reason || 'Administrative review'}\n` +
      `> 🔢 **Remaining Strikes:** ${strikeCount}\n\n` +
      `Your record has been updated. Continue upholding the standards of Valence Healthcare.`,

    // ── LOA APPROVED ─────────────────────────────────────────────────────────
    loaApproved: ({ name, loaStart, loaEnd, loaDuration, actionedBy }) =>
      `## Leave of Absence Approved\n` +
      `Dear **${name}**,\n\n` +
      `Your Leave of Absence request has been **reviewed and approved**.\n\n` +
      `> 📅 **Start Date:** ${loaStart}\n` +
      `> 📅 **End Date:** ${loaEnd}\n` +
      `> ⏱️  **Duration:** ${loaDuration}\n\n` +
      `Your status has been updated in the system. We understand the importance of time away and fully support this.\n\n` +
      `> 🔔 You will receive a reminder **24 hours before your return date**.\n` +
      `> 📋 If you need an extension, contact HR before your LOA concludes.`,

    // ── LOA RETURN REMINDER ──────────────────────────────────────────────────
    loaReturnReminder: ({ name, loaEnd }) =>
      `## LOA Return Reminder\n` +
      `Hi **${name}**,\n\n` +
      `This is a reminder that your **Leave of Absence** concludes **tomorrow, on ${loaEnd}**.\n\n` +
      `> ✅ Your return is expected within **24 hours**\n` +
      `> 📋 If you need an extension, contact HR **immediately**\n` +
      `> 🔄 Failure to return without notice may result in administrative action\n\n` +
      `We look forward to having you back on the team!`,

    // ── LOA ENDED EARLY ──────────────────────────────────────────────────────
    loaEndedEarly: ({ name, actionedBy }) =>
      `## Leave of Absence — Ended\n` +
      `Hi **${name}**,\n\n` +
      `Your Leave of Absence has been **ended early** and your status has been updated to **Active**.\n\n` +
      `Welcome back! Resume your duties and reach out to your department head if you need a briefing.`,

    // ── SESSION PRESENT ──────────────────────────────────────────────────────
    sessionPresent: ({ name, sessionTitle, sessionDate, host }) =>
      `## Attendance Confirmed\n` +
      `Hi **${name}**,\n\n` +
      `Your attendance has been **recorded** for the following session:\n\n` +
      `> 📋 **Session:** ${sessionTitle}\n` +
      `> 📅 **Date:** ${sessionDate}\n` +
      (host ? `> 👤 **Host:** ${host}\n` : '') +
      `\nThank you for your participation. Your dedication to the team is noted and appreciated.`,

    // ── SESSION ABSENT ───────────────────────────────────────────────────────
    sessionAbsent: ({ name, sessionTitle, sessionDate, host }) =>
      `## Absence Recorded\n` +
      `Hi **${name}**,\n\n` +
      `You were marked **absent** for the following session:\n\n` +
      `> 📋 **Session:** ${sessionTitle}\n` +
      `> 📅 **Date:** ${sessionDate}\n` +
      `> 👤 **Host:** ${host}\n\n` +
      `> ⚠️  If this was an error or you have an approved LOA, contact **${host}** or open an HR ticket within **24 hours**.\n` +
      `> 📝 You may also submit an **Absence Justification** through the Staff Portal.`,

    // ── SESSION REMINDER (to host) ───────────────────────────────────────────
    sessionReminder: ({ name, sessionTitle, sessionDate, sessionTime }) =>
      `## Session Reminder — Tomorrow\n` +
      `Hi **${name}**,\n\n` +
      `You are scheduled to **host a session tomorrow**. Here are the details:\n\n` +
      `> 📋 **Session:** ${sessionTitle}\n` +
      `> 📅 **Date:** ${sessionDate}\n` +
      `> 🕐 **Time:** ${sessionTime} EST\n\n` +
      `> ✅ Arrive **30 minutes early** to coordinate with the team\n` +
      `> 📢 Ensure your server is properly configured\n` +
      `> 📋 Record attendance immediately after the session concludes`,

    // ── ABSENCE JUSTIFICATION REVIEWED ───────────────────────────────────────
    absenceReviewed: ({ name, sessionTitle, status, reviewNote, actionedBy }) => {
      const approved = status === 'approved';
      return (
        `## ${approved ? '✅' : '❌'} Absence Justification — ${approved ? 'Approved' : 'Denied'}\n` +
        `Hi **${name}**,\n\n` +
        `Your absence justification for **${sessionTitle}** has been reviewed.\n\n` +
        `> 📋 **Decision:** ${approved ? '**Approved** — your attendance record has been updated' : '**Denied** — the absence remains on your record'}\n` +
        (reviewNote ? `> 💬 **Note from HR:** ${reviewNote}\n` : '') +
        (!approved ? `\nIf you believe this decision is incorrect, please open an **HR ticket within 48 hours**.` : '')
      );
    },

    // ── RANKER PING (to channel) ─────────────────────────────────────────────
    rankerPing: ({ name, robloxUsername, position, discordId, actionedBy }) =>
      `<:valence_mission:1474448341734658261> **Rank Request**\n` +
      `> **Name:** ${name}\n` +
      `> **Roblox Username:** ${robloxUsername}\n` +
      `> **Position:** ${position}\n` +
      `> **Discord:** <@${discordId}>\n\n` +
      `Please rank this member in the Roblox group as soon as possible.\n` +
      `<@&1492585969101045971>`,

    // ── SESSION REMINDER (host) ───────────────────────────────────────────────
    sessionCompleted: ({ name, sessionTitle, sessionDate, presentCount, absentCount }) =>
      `## Session Completed — Summary\n` +
      `Hi **${name}**,\n\n` +
      `Your session has been marked as complete and attendance has been recorded.\n\n` +
      `> 📋 **Session:** ${sessionTitle}\n` +
      `> 📅 **Date:** ${sessionDate}\n` +
      `> ✅ **Present:** ${presentCount}\n` +
      `> ❌ **Absent:** ${absentCount}\n\n` +
      `Individual attendance DMs have been dispatched. Thank you for hosting.`,

    // ── CERTIFICATE ISSUED ────────────────────────────────────────────────────
    certificateIssued: ({ name, certTitle, moduleName, certId }) =>
      `## Certificate Issued\n` +
      `Congratulations **${name}**!\n\n` +
      `You have earned a **certificate** for completing your assigned course of study:\n\n` +
      `> 🎓 **Certificate:** ${certTitle || 'Certificate of Completion'}\n` +
      `> 📚 **Module:** ${moduleName}\n` +
      `> 🔑 **Certificate ID:** \`${certId}\`\n\n` +
      `You can view and download your certificate from the **Learning Hub → Certificates** section.`,

    // ── LOA REQUEST SUBMITTED (confirmation) ──────────────────────────────────
    loaSubmitted: ({ name, startDate, endDate, type }) =>
      `## LOA Request Submitted\n` +
      `Hi **${name}**,\n\n` +
      `Your Leave of Absence request has been **submitted** and is pending HR review.\n\n` +
      `> 📋 **Type:** ${type}\n` +
      `> 📅 **Requested Period:** ${startDate} → ${endDate}\n` +
      `> 🕐 **Status:** Pending Review\n\n` +
      `You will receive a DM once a decision has been made. Please ensure you remain reachable during this period.`,

    // ── STAFF PROFILE UPDATED ─────────────────────────────────────────────────
    profileUpdated: ({ name, changes, actionedBy }) =>
      `## Profile Updated\n` +
      `Hi **${name}**,\n\n` +
      `Your employee profile has been **updated** in the system.\n\n` +
      (changes ? `> **Changes:** ${changes}\n\n` : '') +
      `If you did not expect this change or believe there is an error, please contact HR immediately.`,

    // ── HUB ACCOUNT PROVISIONED ───────────────────────────────────────────────
    hubProvisioned: ({ name, hubLink, actionedBy }) =>
      `## 🖥️  Learning Hub Access Granted\n` +
      `Hi **${name}**,\n\n` +
      `Your **Valence Learning Hub** account has been created and is ready to access.\n\n` +
      `> 📚 Complete assigned training modules\n` +
      `> 🏅 Earn certificates on course completion\n` +
      `> 📋 Track your onboarding progress\n\n` +
      `**[Access the Learning Hub](${hubLink || 'https://valence-a6168.web.app/hub/'})** — sign in with your Discord account.\n`,

    // ── AUTO-TERMINATION (member left server) ────────────────────────────────
    autoTermChannel: ({ name, discordId }) =>
      `🚨 **Auto-Termination**\n` +
      `> **${name}** (\`${discordId}\`) left the server.\n` +
      `> Status updated to **terminated** automatically.\n` +
      `> No DM sent — user is no longer in the server.`,
  },

};
