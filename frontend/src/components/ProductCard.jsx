import { useEffect, useState } from "react";
import { api } from "../services/api";

const frequencies = [
  [30, "Every 30 min"],
  [60, "Every 1 hour"],
  [120, "Every 2 hours"],
  [240, "Every 4 hours"],
  [360, "Every 6 hours"],
  [720, "Every 12 hours"],
  [1440, "Every 24 hours"],
];

function formatPrice(value) {
  if (value == null) return "—";

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }
  ).format(Number(value));
}

function formatDate(value) {
  if (!value) return "Never";

  return new Date(value).toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

export default function ProductCard({
  product,
  onChanged,
}) {
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDetails() {
    try {
      const [historyData, logData] =
        await Promise.all([
          api.getHistory(product.id),
          api.getLogs(product.id),
        ]);

      setHistory(
        historyData.history || []
      );

      setLogs(logData.logs || []);
    } catch (err) {
      setMessage(err.message);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [product.id]);

  async function scrapeNow() {
    try {
      setBusy(true);
      setMessage("Scraping...");

      await api.scrapeNow(product.id);

      await loadDetails();
      onChanged();
      setMessage("Scrape completed.");
    } catch (err) {
      setMessage(err.message);
      await loadDetails();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function changeFrequency(
    event
  ) {
    try {
      setBusy(true);

      await api.updateFrequency(
        product.id,
        Number(event.target.value)
      );

      onChanged();
      setMessage("Frequency updated.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    try {
      setBusy(true);

      await api.toggleActive(
        product.id,
        !product.is_active
      );

      onChanged();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        "Stop tracking this product?"
      )
    ) {
      return;
    }

    try {
      setBusy(true);

      await api.removeProduct(
        product.id
      );

      onChanged();
    } catch (err) {
      setMessage(err.message);
      setBusy(false);
    }
  }

  return (
    <article className="product-card">
      <div className="product-card-top">
        <div>
          <p className="eyebrow">
            TRACKED PRODUCT
          </p>

          <h3>
            {product.product_name}
          </h3>

          <a
            href={product.product_url}
            target="_blank"
            rel="noreferrer"
          >
            Open INE product ↗
          </a>
        </div>

        <span
          className={`status ${
            product.last_status || "pending"
          }`}
        >
          {product.last_status ||
            "pending"}
        </span>
      </div>

      <div className="product-metrics">
        <div>
          <span>Current price</span>
          <strong>
            {formatPrice(
              product.last_price
            )}
          </strong>
        </div>

        <div>
          <span>Stock</span>
          <strong>
            {product.last_stock || "Not scraped yet"}
          </strong>
        </div>

        <div>
          <span>Last scraped</span>
          <strong>
            {formatDate(
              product.last_scraped_at
            )}
          </strong>
        </div>
      </div>

      <div className="product-controls">
        <label>
          Scrape frequency
          <select
            value={
              product.scrape_frequency_minutes
            }
            onChange={changeFrequency}
            disabled={busy}
          >
            {frequencies.map(
              ([minutes, label]) => (
                <option
                  key={minutes}
                  value={minutes}
                >
                  {label}
                </option>
              )
            )}
          </select>
        </label>

        <button
          onClick={scrapeNow}
          disabled={busy}
        >
          {busy
            ? "Working..."
            : "Scrape now"}
        </button>

        <button
          className="secondary"
          onClick={toggleActive}
          disabled={busy}
        >
          {product.is_active
            ? "Pause"
            : "Resume"}
        </button>

        <button
          className="danger"
          onClick={remove}
          disabled={busy}
        >
          Remove
        </button>
      </div>

      {message && (
        <p className="muted">{message}</p>
      )}

      <div className="history-section">
        <div>
          <h4>Price & stock history</h4>

          {history.length === 0 ? (
            <p className="muted">
              No successful scrape yet.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Price</th>
                    <th>Stock</th>
                  </tr>
                </thead>

                <tbody>
                  {history
                    .slice()
                    .reverse()
                    .map((row) => (
                      <tr key={row.id}>
                        <td>
                          {formatDate(
                            row.scraped_at
                          )}
                        </td>
                        <td>
                          {formatPrice(
                            row.price
                          )}
                        </td>
                        <td>
                          {row.stock}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h4>Scrape log</h4>

          {logs.length === 0 ? (
            <p className="muted">
              No scrape attempts yet.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Outcome</th>
                    <th>Attempts</th>
                    <th>Response</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {formatDate(
                          row.started_at
                        )}
                      </td>
                      <td>
                        <span
                          className={`status ${row.status}`}
                        >
                          {row.status}
                        </span>

                        {row.error_message && (
                          <small className="error">
                            {row.error_message}
                          </small>
                        )}
                      </td>
                      <td>
                        {row.attempt_count}
                      </td>
                      <td>
                        {row.response_time_ms
                          ? `${(
                              row.response_time_ms /
                              1000
                            ).toFixed(1)}s`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
