import { useState } from "react";
import { api } from "../services/api";

export default function SearchProducts({ onTracked }) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [error, setError] = useState("");

  async function handleSearch() {
    const value = query.trim();

    if (!value) {
      setProducts([]);
      setError("Please enter a product name.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setProducts([]);

      const data = await api.searchProducts(value);

      setProducts(data.products || []);
    } catch (err) {
      console.error("Product search failed:", err);
      setError(err.message || "Unable to search products.");
    } finally {
      setLoading(false);
    }
  }

  async function track(product) {
    try {
      setTracking(product.url);
      setError("");

      await api.trackProduct({
        productName: product.name,
        productUrl: product.url,
      });

      setQuery("");
      setProducts([]);

      if (onTracked) {
        onTracked();
      }
    } catch (err) {
      console.error("Track product failed:", err);
      setError(err.message || "Unable to track product.");
    } finally {
      setTracking(null);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      handleSearch();
    }
  }

  return (
    <section className="search-panel">
      <div>
        <p className="eyebrow">PRODUCT SEARCH</p>

        <h2>Track an INE product</h2>

        <p className="muted">Search by partial or full product name.</p>
      </div>

      <div className="search-input-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Ironwood, Vantablack..."
          className="search-input"
        />

        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && <p className="muted">Searching...</p>}

      {!loading && products.length > 0 && (
        <div className="search-results">
          {products.map((product) => (
            <div className="search-result" key={product.url}>
              <div>
                <strong>{product.name}</strong>

                <small>{product.url}</small>
              </div>

              <button
                onClick={() => track(product)}
                disabled={tracking === product.url}
              >
                {tracking === product.url ? "Tracking..." : "Track"}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && query.trim() && products.length === 0 && !error && (
        <p className="muted">No products found.</p>
      )}
    </section>
  );
}
