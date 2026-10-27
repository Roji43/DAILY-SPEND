const fs = require('node:fs');
const path = require('node:path');

const paymentReaderPlugin = './modules/payment-reader';

module.exports = ({ config }) => {
  const pluginDirectory = path.join(__dirname, 'modules', 'payment-reader');
  const pluginEntryExists =
    fs.existsSync(path.join(pluginDirectory, 'app.plugin.js')) ||
    fs.existsSync(path.join(pluginDirectory, 'index.js')) ||
    fs.existsSync(path.join(pluginDirectory, 'index.ts'));

  if (!pluginEntryExists) {
    console.warn(
      'Payment reader plugin source is missing; continuing without its native configuration. ' +
        'Restore modules/payment-reader to re-enable the payment-reader feature.'
    );
  }

  return {
    ...config,
    plugins: (config.plugins ?? []).filter((plugin) => {
      const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
      return pluginName !== paymentReaderPlugin || pluginEntryExists;
    }),
  };
};
