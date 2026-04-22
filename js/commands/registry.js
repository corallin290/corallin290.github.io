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

// Split on `&&` (bash-style AND). Each segment is parsed independently.
// Empty segments (e.g. leading/trailing `&&`, or `&& &&`) are dropped so a
// stray separator doesn't produce a no-op step.
export function parseSequence(input) {
  return input
    .split(/\s*&&\s*/)
    .map((seg) => parse(seg))
    .filter((step) => step.name);
}
