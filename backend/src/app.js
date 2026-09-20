require("dotenv").config();

const express = require("express");
const cors = require("cors");

const productRoutes = require("./routes/productRoutes");
const trackedProductRoutes = require("./routes/trackedProductRoutes");
const scrapeRoutes = require("./routes/scrapeRoutes");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: false,
  }),
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "ine-product-price-tracker",
    time: new Date().toISOString(),
  });
});

/*
 * Product catalog/search routes
 *
 * Example:
 * GET /api/products/search?q=Smartwatch
 */
app.use("/api/products", productRoutes);

/*
 * Tracked product routes
 *
 * Example:
 * POST /api/tracked-products
 */
app.use("/api/tracked-products", trackedProductRoutes);

/*
 * Scraper routes
 */
app.use("/api/scraper", scrapeRoutes);

app.use((err, req, res, next) => {
  console.error("[API ERROR]", err);

  const status = Number(err.statusCode) || 500;

  res.status(status).json({
    error: status === 500 ? "Internal server error" : err.message,
  });
});

module.exports = app;
