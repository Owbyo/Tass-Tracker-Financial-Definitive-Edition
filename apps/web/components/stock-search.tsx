"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StockSearch() {
  const [ticker, setTicker] = useState("");
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = ticker.trim().toUpperCase();
        if (!value) return;
        router.push(`/stocks/${value}`);
      }}
      style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}
    >
      <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="Buscar ticker" />
      <button type="submit">Buscar</button>
    </form>
  );
}
