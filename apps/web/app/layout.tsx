import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, sans-serif", margin: "2rem", background: "#0b1020", color: "#e6edf7" }}>
        <header style={{ marginBottom: "1rem" }}>
          <h1>Tass Tracker Financial</h1>
          <nav style={{ display: "flex", gap: "1rem" }}>
            <a href="/" style={{ color: "#8bc3ff" }}>Watchlist</a>
            <a href="/ops" style={{ color: "#8bc3ff" }}>Ops</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
