const express = require("express");

const controller = require("../controllers/trackedProductController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

/*
 * Get all tracked products
 *
 * GET /api/tracked-products
 */
router.get("/", asyncHandler(controller.list));

/*
 * Add a product to tracking
 *
 * POST /api/tracked-products
 */
router.post("/", asyncHandler(controller.create));

/*
 * Dashboard statistics
 *
 * GET /api/tracked-products/stats
 */
router.get("/stats", asyncHandler(controller.stats));

/*
 * Get one tracked product
 *
 * GET /api/tracked-products/:id
 */
router.get("/:id", asyncHandler(controller.detail));

/*
 * Get price history
 *
 * GET /api/tracked-products/:id/history
 */
router.get("/:id/history", asyncHandler(controller.history));

/*
 * Get scrape logs
 *
 * GET /api/tracked-products/:id/logs
 */
router.get("/:id/logs", asyncHandler(controller.logs));

/*
 * Change scrape frequency
 *
 * PATCH /api/tracked-products/:id/frequency
 */
router.patch("/:id/frequency", asyncHandler(controller.frequency));

/*
 * Activate / pause tracking
 *
 * PATCH /api/tracked-products/:id/active
 */
router.patch("/:id/active", asyncHandler(controller.active));

/*
 * Run scraper immediately
 *
 * POST /api/tracked-products/:id/scrape
 */
router.post("/:id/scrape", asyncHandler(controller.runNow));

/*
 * Remove tracked product
 *
 * DELETE /api/tracked-products/:id
 */
router.delete("/:id", asyncHandler(controller.remove));

module.exports = router;
