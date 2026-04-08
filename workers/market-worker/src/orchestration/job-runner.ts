import { JobStatus, JobTriggerType, prisma } from "@tass/db";

export async function runWithJobRecord<T>(
  jobName: string,
  fn: () => Promise<{ recordsRead: number; recordsWritten: number; status?: JobStatus; metadata?: unknown }>,
) {
  const startedAt = new Date();
  const run = await prisma.jobRun.create({
    data: {
      jobName,
      triggerType: JobTriggerType.SCHEDULED,
      status: JobStatus.RUNNING,
      startedAt,
    },
  });

  try {
    const result = await fn();
    const endedAt = new Date();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: result.status ?? JobStatus.SUCCESS,
        endedAt,
        durationMs: endedAt.getTime() - startedAt.getTime(),
        recordsRead: result.recordsRead,
        recordsWritten: result.recordsWritten,
        metadataJson: result.metadata as never,
      },
    });
  } catch (error) {
    const endedAt = new Date();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: JobStatus.FAILED,
        endedAt,
        durationMs: endedAt.getTime() - startedAt.getTime(),
        errorCount: 1,
        errorSummary: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}
