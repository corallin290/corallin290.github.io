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
    // Show the hint wherever tooltip triggers exist (interactive mode).
    // Terminal mode has no [data-tooltip] elements, so the hint is skipped.
    const parts = [];
    const hasTooltips = typeof document !== 'undefined'
      && !!document.querySelector('[data-tooltip]');
    if (hasTooltips) parts.push(i18n.get('help.touchHint'), '');
    parts.push(i18n.get('help.header'), ...lines);
    return { text: parts.join('\n') };
  },
};
