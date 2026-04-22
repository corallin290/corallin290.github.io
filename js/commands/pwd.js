import * as i18n from '../i18n.js';

export default {
  name: 'pwd',
  get description() { return i18n.get('cmd.pwd.description'); },
  usage: 'pwd',
  execute(args, ctx) {
    return { text: ctx.cwd() };
  },
};
