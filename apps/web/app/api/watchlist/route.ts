import { NextResponse } from "next/server";
import { prisma } from "@tass/db";
import { z } from "zod";
import { getWatchlistRows } from "@/lib/data";

const createSchema = z.object({ ticker: z.string().min(1) });

export async function GET() {
  const rows = await getWatchlistRows();
  return NextResponse.json({ items: rows, asOf: new Date().toISOString() });
}

export async function POST(request: Request) {
  const body = createSchema.parse(await request.json());
  const ticker = body.ticker.toUpperCase();

  const symbol = await prisma.symbol.findUnique({ where: { ticker } });
  if (!symbol) {
    return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
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

  return NextResponse.json({ action: "added", message: `${ticker} agregado a watchlist` }, { status: 201 });
}
