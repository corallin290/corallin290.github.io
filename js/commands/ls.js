import * as i18n from '../i18n.js';

export default {
  name: 'ls',
  get description() { return i18n.get('cmd.ls.description'); },
  usage: 'ls [path]',
  async execute(args, ctx) {
    const target = args[0] || ctx.cwd();
    const entries = ctx.fs.list(target, ctx.cwd());

    if (!entries) {
      return { text: i18n.get('err.ls.noSuchDir', { target }), ok: false };
    }

    const names = entries.map((e) => (e.type === 'dir' ? e.name + '/' : e.name));
    return {
      text: names.join('  '),
      items: entries,
    };
  },
};
