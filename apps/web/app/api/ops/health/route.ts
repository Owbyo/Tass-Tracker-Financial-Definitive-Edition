import { NextResponse } from "next/server";
import { getOpsSummary } from "../../../lib/data";

export async function GET() {
  const summary = await getOpsSummary();

  return NextResponse.json({
    status: "ok",
    datasets: {
      quotes: summary.quotes,
      analysis: summary.analysis,
    },
    latestJobs: summary.jobRuns,
  });
}
