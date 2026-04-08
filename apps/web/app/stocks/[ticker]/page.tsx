import { notFound } from "next/navigation";
import { getStockDetail } from "../../../lib/data";

export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const symbol = await getStockDetail(ticker);

  if (!symbol) {
    notFound();
  }

  const latest = symbol.analyses[0];

  return (
    <main>
      <p><a href="/" style={{ color: "#8bc3ff" }}>← Volver a Watchlist</a></p>
      <h2>{symbol.ticker} · {symbol.name}</h2>
      <p>Exchange: {symbol.exchange ?? "N/A"} · Sector: {symbol.sector ?? "N/A"} · Industry: {symbol.industry ?? "N/A"}</p>
      <p>Precio actual: {symbol.quoteLatest?.price?.toString() ?? "N/A"}</p>
      <p>Cambio %: {symbol.quoteLatest?.changePct?.toString() ?? "N/A"}</p>
      <p>Freshness quote: {symbol.quoteFreshnessMinutes === null ? "N/A" : `${symbol.quoteFreshnessMinutes} min`}</p>
      <h3>Último análisis</h3>
      {latest ? (
        <ul>
          <li>Formula version: {latest.formulaVersion}</li>
          <li>Data status placeholder: {latest.isPlaceholder ? "Sí (INSUFFICIENT_DATA técnico)" : "No"}</li>
          <li>Tass Score: {latest.tassScore?.toString() ?? "N/A"}</li>
          <li>Entry Window: {latest.entryWindow ?? "N/A"}</li>
          <li>Exit Window: {latest.exitWindow ?? "N/A"}</li>
        </ul>
      ) : (
        <p>No hay snapshots de análisis todavía.</p>
      )}
      <h3>Histórico de snapshots</h3>
      <table cellPadding={6}>
        <thead><tr><th>Snapshot</th><th>Formula</th><th>Score</th><th>Entry</th><th>Exit</th></tr></thead>
        <tbody>
          {symbol.analyses.map((a) => (
            <tr key={a.id}>
              <td>{a.snapshotAt.toISOString()}</td>
              <td>{a.formulaVersion}</td>
              <td>{a.tassScore?.toString() ?? "-"}</td>
              <td>{a.entryWindow ?? "-"}</td>
              <td>{a.exitWindow ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
