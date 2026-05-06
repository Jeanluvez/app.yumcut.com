export type ProjectDisplayStatus = 'pending' | 'processing' | 'done' | 'failed';

type DeriveProjectDisplayStatusInput = {
  projectStatus?: string | null;
  videoJobs?: Array<{ status?: string | null }> | null;
};

// Temporary compatibility layer: the new workspace UI only uses four
// display states, while some older project records and APIs still carry
// legacy project-level statuses internally.
export function normalizeProjectDisplayStatus(status: string | null | undefined): ProjectDisplayStatus {
  const normalized = (status ?? '').toLowerCase();

  if (normalized === 'done' || normalized === 'completed' || normalized === 'ready') {
    return 'done';
  }

  if (normalized === 'failed' || normalized === 'error' || normalized === 'cancelled') {
    return 'failed';
  }

  if (normalized === 'processing') {
    return 'processing';
  }

  return 'pending';
}

export function deriveProjectDisplayStatus({
  projectStatus,
  videoJobs,
}: DeriveProjectDisplayStatusInput): ProjectDisplayStatus {
  const jobs = Array.isArray(videoJobs) ? videoJobs : [];

  if (jobs.some((job) => (job.status ?? '').toLowerCase() === 'processing')) {
    return 'processing';
  }

  if (jobs.some((job) => (job.status ?? '').toLowerCase() === 'pending')) {
    return 'pending';
  }

  if (jobs.length > 0) {
    const normalizedStatuses = jobs.map((job) => (job.status ?? '').toLowerCase());
    if (normalizedStatuses.every((status) => status === 'done')) {
      return 'done';
    }
    if (normalizedStatuses.every((status) => status === 'failed')) {
      return 'failed';
    }
    if (normalizedStatuses.some((status) => status === 'done')) {
      return 'processing';
    }
    if (normalizedStatuses.some((status) => status === 'failed')) {
      return 'failed';
    }
  }

  return normalizeProjectDisplayStatus(projectStatus);
}
