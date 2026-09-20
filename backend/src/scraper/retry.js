/**
 * Retry an asynchronous operation with backoff.
 *
 * Default:
 *
 * Attempt 1
 *    ↓
 * 2 second delay
 *    ↓
 * Attempt 2
 *    ↓
 * 5 second delay
 *    ↓
 * Attempt 3
 */
async function retryWithBackoff(operation, options = {}) {
  const {
    retries = 3,

    delays = [2000, 5000, 10000],

    onRetry = () => {},
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      console.error(`[SCRAPER] Attempt ${attempt} failed: ${error.message}`);

      // No retry after final attempt.
      if (attempt === retries) {
        break;
      }

      const delay = delays[attempt - 1] ?? delays[delays.length - 1];

      onRetry({
        attempt,
        nextAttempt: attempt + 1,
        delay,
        error,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Delay helper.
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = {
  retryWithBackoff,
};
