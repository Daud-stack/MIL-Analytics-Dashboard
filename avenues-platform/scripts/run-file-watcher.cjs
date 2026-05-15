const path = require('path');
const { register, require: tsxRequire } = require('tsx/cjs/api');

register();
tsxRequire('./file-watcher-main.ts', __filename);
