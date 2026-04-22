import * as i18n from '../i18n.js';

export default {
  name: 'help',
  get description() { return i18n.get('cmd.help.description'); },
  usage: 'help',
  execute(args, ctx) {
    const lines = [];
    for (const cmd of ctx.commands.getAll()) {
      lines.push(`  ${cmd.name.padEnd(10)} ${cmd.description}`);
    }
    return { text: i18n.get('help.header') + '\n' + lines.join('\n') };
  },
};
