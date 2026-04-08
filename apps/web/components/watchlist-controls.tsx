"use client";

import { type ChangeEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function WatchlistControls() {
  const [ticker, setTicker] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    const value = ticker.trim().toUpperCase();
    if (!value) return;

    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: value }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "No se pudo procesar");
        return;
      }

      setMessage(data.message ?? "Actualizado");
      setTicker("");
      router.refresh();
    });
  };

  return (
    <section style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <input
        value={ticker}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setTicker(e.target.value)}
        placeholder="Ticker (ej: AAPL)"
        style={{ padding: "0.4rem", minWidth: 220 }}
      />
      <button type="button" onClick={submit} disabled={pending}>
        {pending ? "Procesando..." : "Agregar / Quitar"}
      </button>
      {message ? <span>{message}</span> : null}
      <span style={{ opacity: 0.8 }}>Si el ticker ya está en watchlist, se quita.</span>
    </section>
  );
}
