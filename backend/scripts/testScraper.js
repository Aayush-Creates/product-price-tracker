require("dotenv").config();

const { scrapeProduct } = require("../src/scraper/ScraperEngine");

const productUrl = process.argv[2];

if (!productUrl) {
  console.error("Usage: node scripts/testScraper.js <product-url>");

  process.exit(1);
}

(async () => {
  console.log("\n==============================");

  console.log("INE PRODUCT SCRAPER TEST");

  console.log("==============================\n");

  const result = await scrapeProduct(productUrl);

  console.log("\n========== RESULT ==========\n");

  console.dir(result, {
    depth: null,
  });

  console.log("\n============================\n");
})();
