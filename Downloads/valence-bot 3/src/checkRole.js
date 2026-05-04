/**
 * checkRole — middleware for slash commands
 * Returns true if the interaction member has any of the required roles for the command.
 * If no roles are configured for the command, everyone is allowed.
 */
const config = require('../config');
const log    = require('./log');

async function checkRole(interaction) {
  const cmdName = interaction.commandName;
  const required = config.commandRoles?.[cmdName];

  // No restriction configured → allow
  if (!required || required.length === 0 || required.every(r => !r)) return true;

  const memberRoles = interaction.member?.roles?.cache;
  if (!memberRoles) return false;

  const hasRole = required.some(roleId => roleId && memberRoles.has(roleId));
  if (!hasRole) {
    await interaction.reply({
      content: 'You do not have permission to use this command.',
      ephemeral: true,
    });
    log.warn(`[Auth] /${cmdName} denied to ${interaction.user.tag}`);
  }
  return hasRole;
}

module.exports = { checkRole };
