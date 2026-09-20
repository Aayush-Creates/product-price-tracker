const axios = require("axios");

const MOCK_STORE_URL =
  process.env.MOCK_STORE_URL || "https://demo.inelabteamdev.com";

const MAX_RESULTS = 20;
const PAGE_SIZE = 1000;
const REQUEST_TIMEOUT = 15000;

/**
 * Searches the INE mock store catalog using its catalog API.
 *
 * The catalog API returns product metadata directly, so there is
 * no need to launch Playwright or open individual product pages.
 *
 * This keeps Playwright reserved for the actual price/stock scraper,
 * where browser interaction is required.
 */
async function searchProducts(query) {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  console.log(`Searching store catalog for: "${query}"`);

  try {
    const catalogUrl = `${MOCK_STORE_URL.replace(/\/$/, "")}/api/catalog`;

    /*
     * Request the largest practical page first.
     * The catalog currently contains 1000 products.
     */
    const firstResponse = await axios.get(catalogUrl, {
      params: {
        page: 1,
        pageSize: PAGE_SIZE,
      },
      timeout: REQUEST_TIMEOUT,
    });

    const firstData = firstResponse.data;

    if (!firstData || !Array.isArray(firstData.items)) {
      throw new Error("Invalid catalog API response.");
    }

    let allItems = [...firstData.items];

    /*
     * If the API limits pageSize and returns multiple pages,
     * fetch the remaining pages.
     */
    const totalPages = Number(firstData.pages) || 1;

    if (totalPages > 1) {
      console.log(
        `Catalog contains ${firstData.total || "unknown"} products across ${totalPages} pages.`,
      );

      const remainingPages = [];

      for (let page = 2; page <= totalPages; page++) {
        remainingPages.push(page);
      }

      /*
       * Fetch remaining pages concurrently.
       * This is still dramatically faster than launching and
       * navigating a browser for every product.
       */
      const responses = await Promise.all(
        remainingPages.map((page) =>
          axios.get(catalogUrl, {
            params: {
              page,
              pageSize: PAGE_SIZE,
            },
            timeout: REQUEST_TIMEOUT,
          }),
        ),
      );

      for (const response of responses) {
        if (response.data && Array.isArray(response.data.items)) {
          allItems.push(...response.data.items);
        }
      }
    }

    /*
     * Filter by product name.
     *
     * This preserves the existing behavior:
     * partial/full product-name matching.
     *
     * Example:
     * "watch" -> all products containing "watch"
     * "ironwood running" -> matching product names
     */
    const matches = allItems.filter((product) => {
      const name = String(product.name || "").toLowerCase();

      return name.includes(normalizedQuery);
    });

    /*
     * Convert catalog records into the same API shape
     * expected by the existing frontend/backend code.
     *
     * The existing application expects:
     * {
     *   name,
     *   url
     * }
     */
    const results = [];
    const seenUrls = new Set();

    for (const product of matches) {
      if (results.length >= MAX_RESULTS) {
        break;
      }

      if (!product.id || !product.name) {
        continue;
      }

      const productUrl = `${MOCK_STORE_URL.replace(
        /\/$/,
        "",
      )}/product/${product.id}`;

      if (seenUrls.has(productUrl)) {
        continue;
      }

      seenUrls.add(productUrl);

      results.push({
        name: product.name,
        url: productUrl,
      });
    }

    console.log(`Found ${results.length} matching product(s) for "${query}".`);

    return results;
  } catch (error) {
    console.error(`Catalog search failed for "${query}":`, error.message);

    throw new Error(`Unable to search product catalog: ${error.message}`);
  }
}

module.exports = {
  searchProducts,
};
