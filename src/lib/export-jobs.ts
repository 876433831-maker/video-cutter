import { randomUUID } from "node:crypto";

export type ExportJobStatus = "queued" | "running" | "completed" | "failed";

export type ExportJob = {
  id: string;
  fileName: string;
  status: ExportJobStatus;
  progress: number;
  stage: string;
  error?: string;
  output?: Buffer;
  createdAt: number;
  updatedAt: number;
};

const JOB_TTL_MS = 1000 * 60 * 20;

function getStore() {
  const scope = globalThis as typeof globalThis & {
    __videoCutterExportJobs__?: Map<string, ExportJob>;
  };

  if (!scope.__videoCutterExportJobs__) {
    scope.__videoCutterExportJobs__ = new Map<string, ExportJob>();
  }

  return scope.__videoCutterExportJobs__;
}

function cleanup() {
  const store = getStore();
  const now = Date.now();

  for (const [jobId, job] of store.entries()) {
    if (now - job.updatedAt > JOB_TTL_MS) {
      store.delete(jobId);
    }
  }
}

export function createExportJob(fileName: string) {
  cleanup();

  const job: ExportJob = {
    id: randomUUID(),
    fileName,
    status: "queued",
    progress: 0,
    stage: "排队中",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  getStore().set(job.id, job);

  return job;
}

export function getExportJob(jobId: string) {
  cleanup();
  return getStore().get(jobId) ?? null;
}

export function updateExportJob(
  jobId: string,
  patch: Partial<Omit<ExportJob, "id" | "createdAt">>
) {
  const store = getStore();
  const job = store.get(jobId);

  if (!job) {
    return null;
  }

  const nextJob: ExportJob = {
    ...job,
    ...patch,
    updatedAt: Date.now()
  };

  store.set(jobId, nextJob);
  return nextJob;
}

export function setExportJobOutput(jobId: string, output: Buffer) {
  return updateExportJob(jobId, {
    output,
    status: "completed",
    progress: 100,
    stage: "导出完成"
  });
}

export function failExportJob(jobId: string, error: string) {
  return updateExportJob(jobId, {
    status: "failed",
    stage: "导出失败",
    error
  });
}

export function consumeExportJobOutput(jobId: string) {
  const store = getStore();
  const job = store.get(jobId);

  if (!job?.output) {
    return null;
  }

  const output = job.output;
  store.set(jobId, {
    ...job,
    output: undefined,
    updatedAt: Date.now()
  });

  return output;
}
