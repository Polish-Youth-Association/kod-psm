import { Firestore } from "@google-cloud/firestore";

const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const databaseId = process.env.FIRESTORE_DB;

if (!projectId) throw new Error("Missing GCP_PROJECT/GOOGLE_CLOUD_PROJECT");
if (!databaseId) throw new Error("Missing FIRESTORE_DB");

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

export const db = new Firestore({ projectId, databaseId });

const COL = "onboardingJobs";

export async function createJob(job: OnboardingJob) {
  await db.collection(COL).doc(job.jobId).set(job, { merge: false });
}

export async function getJob(jobId: string): Promise<OnboardingJob> {
  const snap = await db.collection(COL).doc(jobId).get();
  if (!snap.exists) throw new Error(`Job not found: ${jobId}`);
  return snap.data() as OnboardingJob;
}

export async function patchJob(jobId: string, patch: Record<string, any>) {
  patch.updatedAt = Date.now();
  await db.collection(COL).doc(jobId).set(patch, { merge: true });
}