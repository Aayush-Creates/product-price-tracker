const { scrapeWithBrowser } = require("./browserScraper");
const { retryWithBackoff } = require("./retry");

/**
 * Main scraper engine.
 *
 * Handles:
 * - browser scraping
 * - retries
 * - backoff
 * - failure handling
 * - attempt tracking
 * - response time
 *
 * Options:
 * - headless: true/false
 * - timeout: browser timeout in milliseconds
 */
async function scrapeProduct(productUrl, options = {}) {
  const startTime = Date.now();

  let finalAttempt = 0;

  const headless = options.headless ?? true;
  const timeout = options.timeout ?? 30000;

  try {
    const result = await retryWithBackoff(
      async (attempt) => {
        finalAttempt = attempt;

        console.log(`\n[SCRAPER] Starting attempt ${attempt}`);

        console.log(
          `[SCRAPER] Browser mode: ${headless ? "HEADLESS" : "HEADED"}`,
        );

        return await scrapeWithBrowser(productUrl, {
          headless,
          timeout,
        });
      },
      {
        retries: 3,

        delays: [2000, 5000, 10000],

        onRetry: ({ attempt, nextAttempt, delay }) => {
          console.log(`[SCRAPER] Retry ${nextAttempt} in ${delay}ms`);
        },
      },
    );

    return {
      success: true,

      status: finalAttempt > 1 ? "retried" : "success",

      attemptCount: finalAttempt,

      responseTimeMs: Date.now() - startTime,

      data: result,
    };
  } catch (error) {
    return {
      success: false,

      status: "failed",

      attemptCount: finalAttempt,

      responseTimeMs: Date.now() - startTime,

      error: error.message,
    };
  }
}

module.exports = {
  scrapeProduct,
};
