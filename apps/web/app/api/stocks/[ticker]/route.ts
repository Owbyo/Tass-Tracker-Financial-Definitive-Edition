import { NextResponse } from "next/server";
import { getStockDetail } from "../../../../lib/data";

export async function GET(_: Request, context: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await context.params;
  const symbol = await getStockDetail(ticker);

  if (!symbol) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(JSON.parse(JSON.stringify(symbol, (_, value) => (typeof value === "bigint" ? value.toString() : value))));
}
