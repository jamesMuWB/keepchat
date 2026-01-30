const fs = require('fs');
const path = require('path');

const {
  serializeSessionMeta,
  serializeSessionMessages,
  serializeSessionContext,
} = require('./serialize');

const SESSION_FILES = {
  meta: 'meta.json',
  messages: 'messages.json',
  context: 'context.json',
};

function buildSessionFiles(payload) {
  if (!payload || !payload.meta) {
    throw new Error('Session payload with meta is required');
  }

  return [
    { name: SESSION_FILES.meta, content: serializeSessionMeta(payload.meta) },
    { name: SESSION_FILES.messages, content: serializeSessionMessages(payload.messages) },
    { name: SESSION_FILES.context, content: serializeSessionContext(payload.context) },
  ];
}

function writeSessionFiles(outputDir, payload) {
  if (!outputDir) {
    throw new Error('outputDir is required');
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const files = buildSessionFiles(payload);

  const paths = files.map(({ name, content }) => {
    const filePath = path.join(outputDir, name);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  });

  return {
    outputDir,
    files: paths,
  };
}

module.exports = {
  SESSION_FILES,
  buildSessionFiles,
  writeSessionFiles,
};
