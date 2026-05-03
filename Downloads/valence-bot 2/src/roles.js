const config = require('../config');
const log    = require('./log');

async function grantRoles(client, discordId, position) {
  const guildId = config.guildId;
  if (!guildId || guildId.startsWith('YOUR')) { log.warn('grantRoles: guildId not set'); return; }
  let guild, member;
  try {
    guild  = await client.guilds.fetch(guildId);
    member = await guild.members.fetch(discordId);
  } catch (e) { log.error(`grantRoles: fetch failed for ${discordId}:`, e.message); return; }

  const roleIds = [
    ...(config.positionRoles['*']      || []),
    ...(config.positionRoles[position] || []),
  ];
  for (const roleId of roleIds) {
    if (!roleId || roleId.startsWith('ROLE_ID')) continue;
    try { await member.roles.add(roleId); log.info(`🎖️  +role ${roleId} → ${discordId}`); }
    catch (e) { log.error(`grantRoles: role ${roleId} failed:`, e.message); }
  }
}

async function revokeAllRoles(client, discordId) {
  const guildId = config.guildId;
  if (!guildId || guildId.startsWith('YOUR')) return;
  let guild, member;
  try {
    guild  = await client.guilds.fetch(guildId);
    member = await guild.members.fetch(discordId);
  } catch (e) { log.error(`revokeAllRoles: ${discordId}:`, e.message); return; }

  const allRoleIds = Object.values(config.positionRoles).flat();
  for (const roleId of allRoleIds) {
    if (!roleId || roleId.startsWith('ROLE_ID')) continue;
    try {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        log.info(`🗑️  -role ${roleId} ← ${discordId}`);
      }
    } catch (e) { log.error(`revokeAllRoles: ${roleId}:`, e.message); }
  }
}

module.exports = { grantRoles, revokeAllRoles };
