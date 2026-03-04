import { Firestore } from "@google-cloud/firestore";

const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const databaseId = process.env.FIRESTORE_DB || "(default)";

export const db = new Firestore({
  projectId,
  databaseId, // <-- IMPORTANT: uses your named db "volunteer-onboarding"
});

export type JobStatus = "QUEUED" | "RUNNING" | "FAILED" | "COMPLETED";

export type OnboardingJob = {
  jobId: string;
  status: JobStatus;
  step: string;
  payload: any;
  data: Record<string, any>;
  steps: Record<string, any>;
  createdAt: number;
  updatedAt: number;
};

const COL = "onboardingJobs";

export async function createJob(job: OnboardingJob) {
  await db.collection(COL).doc(job.jobId).set(job, { merge: false });
}

export async function getJob(jobId: string): Promise<OnboardingJob> {
  const snap = await db.collection(COL).doc(jobId).get();
  if (!snap.exists) throw new Error(`Job not found: ${jobId}`);
  return snap.data() as OnboardingJob;
}

/** Firestore supports dot-path keys with merge=true */
export async function patchJob(jobId: string, patch: Record<string, any>) {
  patch.updatedAt = Date.now();
  await db.collection(COL).doc(jobId).set(patch, { merge: true });
}