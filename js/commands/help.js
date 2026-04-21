export default {
  name: 'help',
  description: 'List available commands',
  usage: 'help',
  execute(args, ctx) {
    const lines = [];
    for (const cmd of ctx.commands.getAll()) {
      lines.push(`  ${cmd.name.padEnd(10)} ${cmd.description}`);
    }
    return { text: 'Available commands:\n' + lines.join('\n') };
  },
};
