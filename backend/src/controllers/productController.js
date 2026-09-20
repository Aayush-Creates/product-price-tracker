const { searchProducts } = require("../services/productCatalogService");

async function search(req, res) {
  const q = String(req.query.q || "").trim();

  if (!q) {
    return res.json({ products: [] });
  }

  const products = await searchProducts(q);

  res.json({ products });
}

module.exports = { search };
