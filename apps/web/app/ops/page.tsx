import { getOpsSummary } from "@/lib/data";

export const dynamic = "force-dynamic";

type JobRun = Awaited<ReturnType<typeof getOpsSummary>>["jobRuns"][number];

export default async function OpsPage() {
  const ops = await getOpsSummary();

  return (
    <main>
      <p><a href="/" style={{ color: "#8bc3ff" }}>← Volver</a></p>
      <h2>Ops / Health</h2>
      <ul>
        <li>Quotes persistidos: {ops.quotes.count} · freshness: {ops.quotes.freshnessMinutes ?? "N/A"} min</li>
        <li>Snapshots de análisis: {ops.analysis.count} · freshness: {ops.analysis.freshnessMinutes ?? "N/A"} min</li>
      </ul>
      <h3>Últimos job runs</h3>
      <table cellPadding={6}>
        <thead><tr><th>Job</th><th>Status</th><th>Start</th><th>End</th><th>Read</th><th>Written</th></tr></thead>
        <tbody>
          {ops.jobRuns.map((run: JobRun) => (
            <tr key={run.id}>
              <td>{run.jobName}</td>
              <td>{run.status}</td>
              <td>{run.startedAt.toISOString()}</td>
              <td>{run.endedAt ? run.endedAt.toISOString() : "-"}</td>
              <td>{run.recordsRead}</td>
              <td>{run.recordsWritten}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
