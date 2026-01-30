function toTimestamp(value) {
  if (!value) {
    return 0;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function filterMessages(messages, lastSyncedAt) {
  if (!Array.isArray(messages)) {
    return [];
  }
  if (!lastSyncedAt) {
    return messages;
  }

  const lastSyncTs = toTimestamp(lastSyncedAt);
  return messages.filter((message) => toTimestamp(message.createdAt) > lastSyncTs);
}

function getIncrementalPayload(sessionPayload, lastSyncedAt) {
  if (!sessionPayload) {
    throw new Error('sessionPayload is required');
  }

  const updatedAt = sessionPayload.meta?.updatedAt;
  const hasMetaChange = lastSyncedAt ? toTimestamp(updatedAt) > toTimestamp(lastSyncedAt) : true;

  const messages = filterMessages(sessionPayload.messages, lastSyncedAt);
  const hasMessageChange = messages.length > 0;

  return {
    meta: {
      ...sessionPayload.meta,
      messageCount: messages.length,
    },
    messages,
    context: hasMetaChange ? sessionPayload.context : undefined,
    hasChanges: hasMessageChange || hasMetaChange,
  };
}

module.exports = {
  toTimestamp,
  filterMessages,
  getIncrementalPayload,
};
