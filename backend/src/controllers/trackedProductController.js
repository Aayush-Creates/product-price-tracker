const {
  listTrackedProducts,
  getTrackedProduct,
  createTrackedProduct,
  updateFrequency,
  setActive,
  removeTrackedProduct,
  getDashboardStats,
} = require("../services/trackedProductService");

const {
  getPriceHistory,
  getScrapeLogs,
} = require("../services/historyService");

const { runProductScrape } = require("../services/scrapeService");

/**
 * GET /api/tracked-products
 */
async function list(req, res) {
  res.json({
    products: await listTrackedProducts(),
  });
}

/**
 * POST /api/tracked-products
 *
 * Body:
 * {
 *   "productId": "901",
 *   "productName": "Ironwood Running Watch Studio",
 *   "productUrl": "https://demo.inelabteamdev.com/product/901"
 * }
 *
 * scrapeFrequencyMinutes is optional.
 * Default = 120 minutes.
 */
async function create(req, res) {
  console.log("CREATE PRODUCT BODY:", req.body);

  const { productId, productName, productUrl, scrapeFrequencyMinutes } =
    req.body || {};

  console.log("productId:", productId);
  console.log("productName:", productName);
  console.log("productUrl:", productUrl);

  if (!productName || !productUrl) {
    return res.status(400).json({
      error: "productName and productUrl are required",
      receivedBody: req.body,
    });
  }

  const product = await createTrackedProduct({
    productId,
    productName,
    productUrl,
    scrapeFrequencyMinutes,
  });

  res.status(201).json({
    product,
  });
}

/**
 * GET /api/tracked-products/:id
 */
async function detail(req, res) {
  res.json({
    product: await getTrackedProduct(req.params.id),
  });
}

/**
 * GET /api/tracked-products/:id/history
 */
async function history(req, res) {
  res.json({
    history: await getPriceHistory(req.params.id),
  });
}

/**
 * GET /api/tracked-products/:id/logs
 */
async function logs(req, res) {
  res.json({
    logs: await getScrapeLogs(req.params.id),
  });
}

/**
 * PATCH /api/tracked-products/:id/frequency
 */
async function frequency(req, res) {
  const { scrapeFrequencyMinutes } = req.body || {};

  const product = await updateFrequency(req.params.id, scrapeFrequencyMinutes);

  res.json({
    product,
  });
}

/**
 * PATCH /api/tracked-products/:id/active
 */
async function active(req, res) {
  const product = await setActive(req.params.id, req.body?.isActive);

  res.json({
    product,
  });
}

/**
 * DELETE /api/tracked-products/:id
 */
async function remove(req, res) {
  await removeTrackedProduct(req.params.id);

  res.status(204).send();
}

/**
 * POST /api/tracked-products/:id/scrape
 */
async function runNow(req, res) {
  const result = await runProductScrape(req.params.id);

  res.json(result);
}

/**
 * GET /api/tracked-products/stats
 */
async function stats(req, res) {
  res.json({
    stats: await getDashboardStats(),
  });
}

module.exports = {
  list,
  create,
  detail,
  history,
  logs,
  frequency,
  active,
  remove,
  runNow,
  stats,
};
