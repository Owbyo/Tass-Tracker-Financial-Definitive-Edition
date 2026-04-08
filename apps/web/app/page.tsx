import { WatchlistControls } from "@/components/watchlist-controls";
import { StockSearch } from "@/components/stock-search";
import { getWatchlistRows } from "@/lib/data";

export const dynamic = "force-dynamic";

type WatchlistRow = Awaited<ReturnType<typeof getWatchlistRows>>[number];

export default async function HomePage() {
  const rows = await getWatchlistRows();

  return (
    <main>
      <h2>Watchlist</h2>
      <p>Vista operativa: alta/baja por ticker, quotes persistidos y estado de análisis.</p>
      <StockSearch />
      <WatchlistControls />
      <p>
        <a href="/ops" style={{ color: "#8bc3ff" }}>Ver Ops / Health</a>
      </p>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th align="left">Ticker</th>
            <th align="left">Precio</th>
            <th align="left">% Cambio</th>
            <th align="left">Freshness</th>
            <th align="left">Tass Score</th>
            <th align="left">Entry</th>
            <th align="left">Exit</th>
            <th align="left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: WatchlistRow) => (
            <tr key={row.watchlistItemId} style={{ borderTop: "1px solid #2a3448" }}>
              <td><a href={`/stocks/${row.ticker}`} style={{ color: "#8bc3ff" }}>{row.ticker}</a></td>
              <td>{row.price ?? "-"}</td>
              <td>{row.changePct ?? "-"}</td>
              <td>{row.quoteFreshnessMinutes === null ? "N/A" : `${row.quoteFreshnessMinutes} min`}</td>
              <td>{row.analysis?.tassScore ?? "N/A"}</td>
              <td>{row.analysis?.entryWindow ?? "N/A"}</td>
              <td>{row.analysis?.exitWindow ?? "N/A"}</td>
              <td>{row.analysis?.isPlaceholder ? "Placeholder técnico" : "Listo"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
