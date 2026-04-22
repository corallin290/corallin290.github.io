import * as i18n from '../i18n.js';

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);

export default {
  name: 'help',
  get description() { return i18n.get('cmd.help.description'); },
  usage: 'help',
  execute(args, ctx) {
    const parts = [];
    // Show the hint wherever tooltip triggers exist (interactive mode).
    // Terminal mode has no [data-tooltip] elements, so the hint is skipped.
    const hasTooltips = typeof document !== 'undefined'
      && !!document.querySelector('[data-tooltip]');
    if (hasTooltips) {
      parts.push(`<div class="help-header">${escape(i18n.get('help.touchHint'))}</div>`);
    }
    parts.push(`<div class="help-header">${escape(i18n.get('help.header'))}</div>`);
    for (const cmd of ctx.commands.getAll()) {
      parts.push(
        `<div class="help-row"><span class="help-cmd">${escape(cmd.name)}</span><span>${escape(cmd.description)}</span></div>`
      );
    }
    return { text: parts.join(''), isHtml: true };
  },
};
