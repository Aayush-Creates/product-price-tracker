const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed with status ${response.status}`,
    );
  }

  return data;
}

export const api = {
  searchProducts(q) {
    return request(`/products/search?q=${encodeURIComponent(q)}`);
  },

  getTrackedProducts() {
    return request("/tracked-products");
  },

  getStats() {
    return request("/tracked-products/stats");
  },

  trackProduct(product) {
    const productUrl = product.productUrl || product.url;

    // Extract product ID from:
    // https://demo.inelabteamdev.com/product/313
    const productId =
      product.productId ||
      productUrl?.match(/\/product\/([^/?#]+)/)?.[1] ||
      null;

    return request("/tracked-products", {
      method: "POST",
      body: JSON.stringify({
        productId,
        productName: product.productName || product.name,
        productUrl,
        scrapeFrequencyMinutes: product.scrapeFrequencyMinutes || 120,
      }),
    });
  },
  getHistory(id) {
    return request(`/tracked-products/${id}/history`);
  },

  getLogs(id) {
    return request(`/tracked-products/${id}/logs`);
  },

  updateFrequency(id, minutes) {
    return request(`/tracked-products/${id}/frequency`, {
      method: "PATCH",
      body: JSON.stringify({
        scrapeFrequencyMinutes: minutes,
      }),
    });
  },

  toggleActive(id, isActive) {
    return request(`/tracked-products/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({
        isActive,
      }),
    });
  },

  scrapeNow(id) {
    return request(`/tracked-products/${id}/scrape`, {
      method: "POST",
    });
  },

  removeProduct(id) {
    return request(`/tracked-products/${id}`, {
      method: "DELETE",
    });
  },
};
