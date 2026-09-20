require("dotenv").config();

const { scrapeProduct } = require("../src/scraper/ScraperEngine");

const PRODUCT_URL =
  process.argv[2] || "https://demo.inelabteamdev.com/product/901";

(async () => {
  console.log("\n==============================================");
  console.log(" INE PRODUCT SCRAPER - HEADED DEMONSTRATION");
  console.log("==============================================\n");

  console.log("[DEMO] Product URL:");
  console.log(PRODUCT_URL);

  console.log("\n[DEMO] Browser mode: HEADED");
  console.log("[DEMO] Browser window will open visibly.");
  console.log("[DEMO] Retry/backoff handling is enabled.");
  console.log("[DEMO] Maximum attempts: 4\n");

  const startTime = Date.now();

  try {
    const result = await scrapeProduct(PRODUCT_URL, {
      headless: false,
      timeout: 30000,
    });

    const totalTime = Date.now() - startTime;

    console.log("\n==============================================");
    console.log(" FINAL SCRAPE RESULT");
    console.log("==============================================");

    console.dir(result, {
      depth: null,
    });

    console.log("\n==============================================");
    console.log(" DEMONSTRATION SUMMARY");
    console.log("==============================================");

    console.log(`Status: ${result.status}`);
    console.log(`Success: ${result.success}`);
    console.log(`Attempts: ${result.attemptCount}`);
    console.log(`Response time: ${result.responseTimeMs} ms`);
    console.log(`Total execution time: ${totalTime} ms`);

    if (result.success) {
      console.log(`Price: ${result.data.price}`);
      console.log(`Stock: ${result.data.stock}`);

      if (result.attemptCount > 1) {
        console.log("\n✓ The scraper recovered after one or more retries.");
      } else {
        console.log(
          "\n✓ The scraper completed successfully on the first attempt.",
        );
      }
    } else {
      console.log("\n✗ Scrape failed after all retry attempts.");
      console.log(`Error: ${result.error}`);
    }

    console.log("\n==============================================\n");
  } catch (error) {
    console.error("\n==============================================");
    console.error(" UNEXPECTED DEMONSTRATION ERROR");
    console.error("==============================================");

    console.error(error);
  }
})();
