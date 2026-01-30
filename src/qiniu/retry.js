function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(operation, options = {}) {
  const { retries = 3, delayMs = 500, shouldRetry } = options;
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      const retryAllowed = attempt < retries && (!shouldRetry || shouldRetry(error));
      if (!retryAllowed) {
        throw error;
      }
      await sleep(delayMs * attempt);
    }
  }
}

module.exports = {
  withRetry,
};
