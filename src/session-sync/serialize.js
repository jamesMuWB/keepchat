function serializeJson(data) {
  return JSON.stringify(data, null, 2);
}

function serializeSessionPayload(payload) {
  return serializeJson(payload);
}

function serializeSessionMeta(meta) {
  return serializeJson(meta);
}

function serializeSessionMessages(messages) {
  return serializeJson(messages);
}

function serializeSessionContext(context) {
  return serializeJson(context);
}

module.exports = {
  serializeJson,
  serializeSessionPayload,
  serializeSessionMeta,
  serializeSessionMessages,
  serializeSessionContext,
};
