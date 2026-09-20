require("dotenv").config();

const { runDueScrapes } = require("../src/services/scrapeService");

(async () => {
  try {
    console.log("[CRON] Starting due-product scrape run...");

    const result = await runDueScrapes();

    console.log(JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("[CRON] Failed:", error);

    process.exit(1);
  }
})();
