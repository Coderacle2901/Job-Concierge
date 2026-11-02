const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  //   Force Puppeteer to hide Chrome inside node_modules 
  // so Render automatically caches it across all future deployments!
  cacheDirectory: join(__dirname, 'node_modules', '.puppeteer_cache'),
};