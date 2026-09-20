const supabase = require("../config/supabase");

const DEFAULT_FREQUENCY = 120;

/**
 * Get all tracked products.
 */
async function listTrackedProducts() {
  const { data, error } = await supabase
    .from("tracked_products")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get one tracked product.
 */
async function getTrackedProduct(id) {
  const { data, error } = await supabase
    .from("tracked_products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Create a tracked product.
 *
 * Default scrape frequency:
 * 120 minutes
 *
 * Default active state:
 * true
 *
 * next_scrape_at:
 * current time + frequency
 */
async function createTrackedProduct({
  productId = null,
  productName,
  productUrl,
  scrapeFrequencyMinutes = DEFAULT_FREQUENCY,
}) {
  const frequency = Number(scrapeFrequencyMinutes);

  /*
   * Validate frequency.
   */
  if (!Number.isInteger(frequency) || frequency < 30) {
    throw new Error("scrapeFrequencyMinutes must be an integer of at least 30");
  }

  /*
   * Calculate the first scheduled scrape.
   *
   * Example:
   *
   * Current time = 8:00 PM
   * Frequency = 120 minutes
   * next_scrape_at = 10:00 PM
   */
  const nextScrapeAt = new Date(
    Date.now() + frequency * 60 * 1000,
  ).toISOString();

  /*
   * Insert into Supabase.
   */
  const { data, error } = await supabase
    .from("tracked_products")
    .insert({
      product_id: productId,
      product_name: productName,
      product_url: productUrl,

      /*
       * Automatically assigned.
       */
      scrape_frequency_minutes: frequency,

      /*
       * Automatically active.
       */
      is_active: true,

      /*
       * Automatically calculated.
       */
      next_scrape_at: nextScrapeAt,

      /*
       * No scrape has happened yet.
       */
      last_scraped_at: null,
      last_price: null,
      last_stock: null,
      last_status: null,
    })
    .select("*")
    .single();

  if (error) {
    /*
     * product_url is UNIQUE in Supabase.
     */
    if (error.code === "23505") {
      throw new Error("This product is already being tracked");
    }

    throw error;
  }

  return data;
}

/**
 * Change scrape frequency.
 */
async function updateFrequency(id, scrapeFrequencyMinutes) {
  const frequency = Number(scrapeFrequencyMinutes);

  if (!Number.isInteger(frequency) || frequency < 30) {
    throw new Error("scrapeFrequencyMinutes must be an integer of at least 30");
  }

  /*
   * Schedule next scrape based on the
   * newly selected frequency.
   */
  const nextScrapeAt = new Date(
    Date.now() + frequency * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("tracked_products")
    .update({
      scrape_frequency_minutes: frequency,
      next_scrape_at: nextScrapeAt,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Activate or pause a tracked product.
 */
async function setActive(id, isActive) {
  const active = Boolean(isActive);

  const updateData = {
    is_active: active,
  };

  /*
   * When activating, schedule the next scrape
   * based on the configured frequency.
   */
  if (active) {
    const { data: currentProduct, error: fetchError } = await supabase
      .from("tracked_products")
      .select("scrape_frequency_minutes")
      .eq("id", id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const frequency = Number(
      currentProduct.scrape_frequency_minutes || DEFAULT_FREQUENCY,
    );

    updateData.next_scrape_at = new Date(
      Date.now() + frequency * 60 * 1000,
    ).toISOString();
  }

  /*
   * When paused:
   * - only set is_active = false
   * - keep the existing next_scrape_at value
   *
   * This is required because next_scrape_at is NOT NULL.
   */
  const { data, error } = await supabase
    .from("tracked_products")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Remove tracked product.
 */
async function removeTrackedProduct(id) {
  const { error } = await supabase
    .from("tracked_products")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

/**
 * Get products that are due for scraping.
 */
async function getDueProducts(limit = 20) {
  const { data, error } = await supabase
    .from("tracked_products")
    .select("*")
    .eq("is_active", true)
    .lte("next_scrape_at", new Date().toISOString())
    .order("next_scrape_at", {
      ascending: true,
    })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Update latest scrape state.
 */
async function updateLatestState(id, state) {
  const { data, error } = await supabase
    .from("tracked_products")
    .update({
      last_scraped_at: state.lastScrapedAt,
      last_price: state.price ?? null,
      last_stock: state.stock ?? null,
      last_status: state.status,
      next_scrape_at: state.nextScrapeAt,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Dashboard statistics.
 */
async function getDashboardStats() {
  const { data, error } = await supabase
    .from("tracked_products")
    .select("id,is_active,last_status,last_stock,last_price");

  if (error) {
    throw error;
  }

  const rows = data || [];

  const pricedRows = rows.filter((r) => Number.isFinite(Number(r.last_price)));

  return {
    trackedProducts: rows.length,

    activeProducts: rows.filter((r) => r.is_active).length,

    successfulScrapes: rows.filter((r) => r.last_status === "success").length,

    retriedProducts: rows.filter((r) => r.last_status === "retried").length,

    failedProducts: rows.filter((r) => r.last_status === "failed").length,

    outOfStock: rows.filter(
      (r) => String(r.last_stock || "").toUpperCase() === "OUT OF STOCK",
    ).length,

    averageCurrentPrice:
      pricedRows.length > 0
        ? pricedRows.reduce((sum, r) => sum + Number(r.last_price), 0) /
          pricedRows.length
        : null,
  };
}

module.exports = {
  listTrackedProducts,
  getTrackedProduct,
  createTrackedProduct,
  updateFrequency,
  setActive,
  removeTrackedProduct,
  getDueProducts,
  updateLatestState,
  getDashboardStats,
};
