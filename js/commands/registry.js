import help from './help.js';
import ls from './ls.js';
import cat from './cat.js';
import cd from './cd.js';
import pwd from './pwd.js';
import clear from './clear.js';

const commands = new Map();

for (const cmd of [help, ls, cat, cd, pwd, clear]) {
  commands.set(cmd.name, cmd);
}

export function getCommand(name) {
  return commands.get(name) || null;
}

export function getAll() {
  return [...commands.values()];
}

export function parse(input) {
  const tokens = input.trim().split(/\s+/);
  const name = tokens[0] || '';
  const args = tokens.slice(1);
  return { name, args };
}
