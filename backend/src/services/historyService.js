const supabase = require("../config/supabase");

async function getPriceHistory(trackedProductId, limit = 100) {
  const { data, error } = await supabase
    .from("price_history")
    .select("*")
    .eq("tracked_product_id", trackedProductId)
    .order("scraped_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return data;
}

async function getScrapeLogs(trackedProductId, limit = 100) {
  const { data, error } = await supabase
    .from("scrape_logs")
    .select("*")
    .eq("tracked_product_id", trackedProductId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data;
}

module.exports = {
  getPriceHistory,
  getScrapeLogs,
};
