export default function StatsCards({
  stats,
}) {
  const cards = [
    ["Tracked", stats?.trackedProducts ?? 0],
    ["Active", stats?.activeProducts ?? 0],
    ["Successful", stats?.successfulScrapes ?? 0],
    ["Retried", stats?.retriedProducts ?? 0],
    ["Failed", stats?.failedProducts ?? 0],
    ["Out of stock", stats?.outOfStock ?? 0],
  ];

  return (
    <div className="stats-grid">
      {cards.map(([label, value]) => (
        <div className="stat-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
