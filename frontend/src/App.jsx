import { useEffect, useState } from "react";
import SearchProducts from "./components/SearchProducts";
import StatsCards from "./components/StatsCards";
import ProductCard from "./components/ProductCard";
import { api } from "./services/api";
import "./styles.css";

export default function App() {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [productsData, statsData] = await Promise.all([
        api.getTrackedProducts(),
        api.getStats(),
      ]);

      setProducts(productsData.products || []);

      setStats(statsData.stats || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="app">
      <header className="site-header">
        <div>
          <p className="eyebrow">INE PRODUCT PRICE TRACKER</p>

          <h1>
            Track prices.
            <br />
            Understand changes.
          </h1>
        </div>

        <button className="secondary" onClick={loadDashboard}>
          Refresh dashboard
        </button>
      </header>

      <main>
        <StatsCards stats={stats} />

        <SearchProducts onTracked={loadDashboard} />

        <section className="tracked-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MONITORING</p>

              <h2>Tracked products</h2>
            </div>

            <span className="muted">
              {products.length} product
              {products.length === 1 ? "" : "s"} tracked
            </span>
          </div>

          {loading ? (
            <p className="muted">Loading dashboard...</p>
          ) : error ? (
            <p className="error">{error}</p>
          ) : products.length === 0 ? (
            <div className="empty">
              <h3>Nothing tracked yet</h3>
              <p>Search the INE store above and track your first product.</p>
            </div>
          ) : (
            <div className="product-list">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onChanged={loadDashboard}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
