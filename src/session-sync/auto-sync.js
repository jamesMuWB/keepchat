function createAutoSync({ intervalMs = 5 * 60 * 1000, messageThreshold = 10, onSync } = {}) {
  let timer = null;
  let pendingMessages = 0;

  function start() {
    if (timer) {
      return;
    }
    timer = setInterval(() => {
      if (onSync) {
        onSync({ reason: 'interval' });
      }
    }, intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function recordMessage(count = 1) {
    pendingMessages += count;
    if (pendingMessages >= messageThreshold) {
      pendingMessages = 0;
      if (onSync) {
        onSync({ reason: 'message-threshold' });
      }
    }
  }

  function isRunning() {
    return Boolean(timer);
  }

  return {
    start,
    stop,
    recordMessage,
    isRunning,
  };
}

module.exports = {
  createAutoSync,
};
