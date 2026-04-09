import { NextResponse } from "next/server";
import { prisma } from "@tass/db";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getWatchlistRows } from "@/lib/data";

const createSchema = z.object({ ticker: z.string().min(1) });
const usTickerSchema = /^[A-Z][A-Z0-9.-]{0,9}$/;
const execFileAsync = promisify(execFile);

type ResolvedSymbol = {
  ticker: string;
  name: string;
  exchange: string;
};

function normalizeTickerInput(rawTicker: string): string {
  return rawTicker.trim().toUpperCase().replace(/\.US$/, "");
}

async function resolveSymbolFromProvider(ticker: string): Promise<ResolvedSymbol | null> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    throw new Error("Missing EODHD_API_KEY for US validation");
  }

  const url = `https://eodhd.com/api/search/${ticker}?api_token=${apiKey}&fmt=json&exchange=US`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`EODHD symbol search failed for ${ticker}: ${response.status}`);
  }

  const rows = (await response.json()) as Array<{ Code?: string; Name?: string; Exchange?: string }>;
  const match = rows.find((row) => (row.Code ?? "").toUpperCase() === ticker);
  if (!match) return null;

  return {
    ticker,
    name: match.Name?.trim() || ticker,
    exchange: "US",
  };
}

async function runWorkerJob(jobScript: "job:quotes" | "job:analysis", ticker: string) {
  await execFileAsync("npm", ["run", "-w", "workers/market-worker", jobScript, "--", `--ticker=${ticker}`], {
    cwd: process.cwd(),
    env: process.env,
    timeout: 120_000,
    maxBuffer: 1024 * 1024 * 8,
  });
}

async function bootstrapTickerData(ticker: string) {
  await runWorkerJob("job:quotes", ticker);
  await runWorkerJob("job:analysis", ticker);
}

export async function GET() {
  const rows = await getWatchlistRows();
  return NextResponse.json({ items: rows, asOf: new Date().toISOString() });
}

export async function POST(request: Request) {
  const body = createSchema.parse(await request.json());
  const ticker = normalizeTickerInput(body.ticker);
  if (!usTickerSchema.test(ticker)) {
    return NextResponse.json({ error: "Ticker inválido. Usa un símbolo US válido (ej: NVDA)." }, { status: 400 });
  }

  let symbol = await prisma.symbol.findUnique({ where: { ticker } });
  if (!symbol) {
    try {
      const resolved = await resolveSymbolFromProvider(ticker);
      if (!resolved) {
        return NextResponse.json({ error: `Ticker ${ticker} no existe en el mercado US (provider)` }, { status: 404 });
      }

      symbol = await prisma.symbol.create({
        data: {
          ticker: resolved.ticker,
          name: resolved.name,
          exchange: resolved.exchange,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: `No se pudo validar ${ticker} contra el provider`, detail: error instanceof Error ? error.message : String(error) },
        { status: 502 },
      );
    }
  }

  const existing = await prisma.watchlistItem.findUnique({ where: { symbolId: symbol.id } });

  if (existing && existing.isActive) {
    await prisma.watchlistItem.update({ where: { id: existing.id }, data: { isActive: false } });
    return NextResponse.json({ action: "removed", message: `${ticker} removido de watchlist` });
  }

  const maxOrder = await prisma.watchlistItem.aggregate({ _max: { positionOrder: true } });
  await prisma.watchlistItem.upsert({
    where: { symbolId: symbol.id },
    create: { symbolId: symbol.id, positionOrder: (maxOrder._max.positionOrder ?? 0) + 1, isActive: true },
    update: { isActive: true, positionOrder: (maxOrder._max.positionOrder ?? 0) + 1 },
  });

  try {
    await bootstrapTickerData(ticker);
  } catch (error) {
    return NextResponse.json(
      {
        action: "added",
        message: `${ticker} agregado a watchlist, pero bootstrap incompleto`,
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 202 },
    );
  }

  return NextResponse.json({ action: "added", message: `${ticker} agregado a watchlist` }, { status: 201 });
}
