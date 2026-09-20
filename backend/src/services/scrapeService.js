const supabase = require("../config/supabase");
const {
  getTrackedProduct,
  getDueProducts,
  updateLatestState,
} = require("./trackedProductService");

// Existing, already-tested scraper.
const { scrapeWithBrowser } = require("../scraper/browserScraper");

async function createScrapeLog(trackedProductId, startedAt) {
  const { data, error } = await supabase
    .from("scrape_logs")
    .insert({
      tracked_product_id: trackedProductId,
      started_at: startedAt,
      status: "failed",
      attempt_count: 1,
    })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

async function updateScrapeLog(id, patch) {
  const { data, error } = await supabase
    .from("scrape_logs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

async function savePriceHistory({
  trackedProductId,
  price,
  stock,
  scrapedAt,
  scrapeLogId,
}) {
  const { data, error } = await supabase
    .from("price_history")
    .insert({
      tracked_product_id: trackedProductId,
      price,
      stock,
      scraped_at: scrapedAt,
      scrape_log_id: scrapeLogId,
    })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

function classifyStatus(result) {
  if (result.attemptCount && result.attemptCount > 1) {
    return "retried";
  }

  if (result.status === "failed") {
    return "failed";
  }

  return "success";
}

async function scrapeTrackedProduct(trackedProduct) {
  const startedAt = new Date();
  const startedMs = Date.now();

  const log = await createScrapeLog(
    trackedProduct.id,
    startedAt.toISOString()
  );

  try {
    const result = await scrapeWithBrowser(
      trackedProduct.product_url,
      {
        headless: true,
        timeout: Number(process.env.SCRAPER_TIMEOUT || 30000),
      }
    );

    const completedAt = new Date();
    const responseTimeMs = Date.now() - startedMs;
    const status = classifyStatus(result);

    // Never write history until both price and stock are valid.
    if (
      !Number.isFinite(Number(result.price)) ||
      Number(result.price) <= 0 ||
      !result.stock
    ) {
      throw new Error(
        "Scraper returned invalid price or stock; history was not written"
      );
    }

    await savePriceHistory({
      trackedProductId: trackedProduct.id,
      price: Number(result.price),
      stock: String(result.stock),
      scrapedAt: completedAt.toISOString(),
      scrapeLogId: log.id,
    });

    const nextScrapeAt = new Date(
      completedAt.getTime() +
        trackedProduct.scrape_frequency_minutes * 60 * 1000
    );

    await updateScrapeLog(log.id, {
      completed_at: completedAt.toISOString(),
      status,
      attempt_count: Number(result.attemptCount || 1),
      response_time_ms: responseTimeMs,
      price: Number(result.price),
      stock: String(result.stock),
      error_message: null,
    });

    await updateLatestState(trackedProduct.id, {
      lastScrapedAt: completedAt.toISOString(),
      price: Number(result.price),
      stock: String(result.stock),
      status,
      nextScrapeAt: nextScrapeAt.toISOString(),
    });

    return {
      trackedProductId: trackedProduct.id,
      status,
      price: Number(result.price),
      stock: String(result.stock),
      attemptCount: Number(result.attemptCount || 1),
      responseTimeMs,
    };
  } catch (error) {
    const completedAt = new Date();
    const responseTimeMs = Date.now() - startedMs;

    const attemptCount = Number(error.attemptCount || 1);

    await updateScrapeLog(log.id, {
      completed_at: completedAt.toISOString(),
      status: "failed",
      attempt_count: attemptCount,
      response_time_ms: responseTimeMs,
      price: null,
      stock: null,
      error_message: String(error.message || error),
    });

    // IMPORTANT:
    // A failed scrape does not overwrite the last known good price/stock.
    // It only advances the next scheduled run.
    const nextScrapeAt = new Date(
      completedAt.getTime() +
        trackedProduct.scrape_frequency_minutes * 60 * 1000
    );

    await updateLatestState(trackedProduct.id, {
      lastScrapedAt: completedAt.toISOString(),
      price: trackedProduct.last_price,
      stock: trackedProduct.last_stock,
      status: "failed",
      nextScrapeAt: nextScrapeAt.toISOString(),
    });

    const wrapped = new Error(
      error.message || "Scrape failed"
    );

    wrapped.attemptCount = attemptCount;
    throw wrapped;
  }
}

async function runProductScrape(trackedProductId) {
  const product = await getTrackedProduct(trackedProductId);

  if (!product) {
    throw new Error("Tracked product not found");
  }

  return scrapeTrackedProduct(product);
}

async function runDueScrapes() {
  const products = await getDueProducts(
    Number(process.env.SCRAPE_BATCH_SIZE || 10)
  );

  const results = [];

  // Sequential execution avoids launching many browsers at once.
  for (const product of products) {
    try {
      const result =
        await scrapeTrackedProduct(product);

      results.push({
        productId: product.id,
        productName: product.product_name,
        success: true,
        ...result,
      });
    } catch (error) {
      results.push({
        productId: product.id,
        productName: product.product_name,
        success: false,
        status: "failed",
        error: error.message,
      });
    }
  }

  return {
    checked: products.length,
    results,
  };
}

module.exports = {
  runProductScrape,
  runDueScrapes,
};
