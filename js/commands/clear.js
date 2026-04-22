import * as i18n from '../i18n.js';

export default {
  name: 'clear',
  get description() { return i18n.get('cmd.clear.description'); },
  usage: 'clear',
  execute() {
    return { clear: true };
  },
};
