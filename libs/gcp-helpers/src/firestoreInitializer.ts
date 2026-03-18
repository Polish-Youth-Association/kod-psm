import admin from 'firebase-admin';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export type FirestoreConfig = {
  /**
   * The Firestore named database ID as declared in infra/db.yaml.
   * e.g. 'psm-member-platform' or 'psm-chat-sessions'
   */
  databaseId: string;
  /**
   * GCP project ID. Defaults to the project inferred from
   * Application Default Credentials (ADC) — usually correct on Cloud Run.
   */
  projectId?: string;
};

/**
 * Returns an initialised Firestore client for the given named database.
 *
 * On Cloud Run, authentication is handled automatically via the attached
 * service account (ADC) — no credentials file needed.
 *
 * Locally, run `gcloud auth application-default login` once, or set
 * FIRESTORE_EMULATOR_HOST to point at the Firebase emulator.
 */
export function initFirestore(config: FirestoreConfig): Firestore {
  if (!admin.apps.length) {
    admin.initializeApp(
      config.projectId ? { projectId: config.projectId } : undefined
    );
  }

  return getFirestore(admin.app(), config.databaseId);
}
