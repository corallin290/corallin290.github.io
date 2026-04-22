import * as i18n from '../i18n.js';

export default {
  name: 'cat',
  get description() { return i18n.get('cmd.cat.description'); },
  usage: 'cat <file>',
  async execute(args, ctx) {
    if (!args[0]) {
      return { text: i18n.get('err.cat.usage'), ok: false };
    }

    const content = await ctx.fs.read(args[0], ctx.cwd());
    if (content === null) {
      return { text: i18n.get('err.cat.noSuchFile', { name: args[0] }), ok: false };
    }

    return { text: content, isMarkdown: true };
  },
};
