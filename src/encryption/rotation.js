const { generateApiKey } = require('./keys');
const { saveEncryptionConfig } = require('./config');

function rotateApiKey() {
  const newApiKey = generateApiKey();
  saveEncryptionConfig({ apiKey: newApiKey });
  return newApiKey;
}

module.exports = {
  rotateApiKey,
};
