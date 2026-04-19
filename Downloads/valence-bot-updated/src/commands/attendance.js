const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('attendance')
    .setDescription('View attendance summary for a staff member')
    .addUserOption(o => o.setName('member').setDescription('Staff member (defaults to yourself)').setRequired(false)),

  async execute(interaction, client, db) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('member') || interaction.user;

    // Find staff record
    const staffSnap = await db.collection('staff')
      .where('discordId', '==', target.id).limit(1).get();
    if (staffSnap.empty) {
      return interaction.editReply({ content: `❌ No staff record for <@${target.id}>.` });
    }
    const staff = staffSnap.docs[0].data();
    const roblox = staff.robloxUsername || '';

    // Get sessions with attendance
    const sessSnap = await db.collection('sessions')
      .where('attendanceRecorded', '==', true)
      .orderBy('date', 'desc').limit(30).get();

    let present = 0, absent = 0, excused = 0;
    const recent = [];

    sessSnap.forEach(doc => {
      const s = doc.data();
      const att = s.attendees || [];
      const record = att.find(a =>
        a.staffId === staffSnap.docs[0].id ||
        (roblox && a.roblox?.toLowerCase() === roblox.toLowerCase())
      );
      if (!record) return;
      if (record.status === 'present')  { present++;  }
      if (record.status === 'absent')   { absent++;   }
      if (record.status === 'excused')  { excused++;  }
      if (recent.length < 5) {
        const emoji = record.status === 'present' ? '✅' : record.status === 'excused' ? '🟡' : '❌';
        recent.push(`${emoji} **${s.title || 'Session'}** — ${s.date}`);
      }
    });

    const total = present + absent + excused;
    const rate  = total ? Math.round((present / total) * 100) : 0;

    const embed = new EmbedBuilder()
      .setColor(rate >= 75 ? 0x7ed957 : rate >= 50 ? 0xf59e0b : 0xe53e3e)
      .setTitle(`📊 Attendance — ${staff.rpName || roblox || target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 64 }))
      .addFields(
        { name: '✅ Present',        value: String(present), inline: true },
        { name: '❌ Absent',         value: String(absent),  inline: true },
        { name: '🟡 Excused',        value: String(excused), inline: true },
        { name: '📈 Attendance Rate',value: `${rate}%`,      inline: true },
        { name: '📋 Total Sessions', value: String(total),   inline: true },
      )
      .setFooter({ text: 'Last 30 sessions · Valence Healthcare' })
      .setTimestamp();

    if (recent.length) {
      embed.addFields({ name: '🕐 Recent', value: recent.join('\n'), inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
