import { Firestore } from "@google-cloud/firestore";

const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const databaseId = process.env.FIRESTORE_DB; // MUST be set

if (!projectId) throw new Error("Missing GCP_PROJECT/GOOGLE_CLOUD_PROJECT");
if (!databaseId) throw new Error("Missing FIRESTORE_DB (expected 'volunteer-onboarding')");

console.log("[firestore] using", { projectId, databaseId });

export const db = new Firestore({ projectId, databaseId });

const COL = "onboardingJobs";

export async function createJob(job: any) {
  await db.collection(COL).doc(job.jobId).set(job, { merge: false });
}
export async function getJob(jobId: string) {
  const snap = await db.collection(COL).doc(jobId).get();
  if (!snap.exists) throw new Error(`Job not found: ${jobId}`);
  return snap.data();
}
export async function patchJob(jobId: string, patch: Record<string, any>) {
  patch.updatedAt = Date.now();
  await db.collection(COL).doc(jobId).set(patch, { merge: true });
}