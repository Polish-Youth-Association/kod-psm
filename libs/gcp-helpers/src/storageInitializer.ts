// libs/gcp-helpers/src/storageInitializer.ts
import { Storage } from '@google-cloud/storage';
import fs from 'node:fs/promises';
import path from 'node:path';

export type StorageBackend = 'local' | 'gcs';

export type SaveResult = {
  backend: StorageBackend;
  objectPath: string;
  localPath?: string;
  url?: string;
};

export type StorageConfig = {
  bucketName?: string;
  projectId?: string;
  localBaseDir: string; // where to store files in dev
};

export type StorageClient = {
  backend: StorageBackend;
  saveFile: (
    buffer: Uint8Array,
    objectPath: string, // e.g. "certificates/123.pdf"
    contentType?: string,
    metadata?: Record<string, string>,
  ) => Promise<SaveResult>;
  getFile: (objectPath: string) => Promise<Buffer>;
};

// Cloud Run exposes K_SERVICE – good enough to differentiate envs
const isCloudRun = !!process.env.K_SERVICE;

export function initStorage(config: StorageConfig): StorageClient {
  const { bucketName, projectId, localBaseDir } = config;

  const useGcs = isCloudRun && !!bucketName;

  const storage = useGcs
    ? new Storage(projectId ? { projectId } : undefined)
    : null;

  const bucket =
    storage && bucketName ? storage.bucket(bucketName) : null;

  async function saveFile(
    buffer: Uint8Array,
    objectPath: string,
    contentType = 'application/octet-stream',
    metadata: Record<string, string> = {},
  ): Promise<SaveResult> {
    if (bucket && bucketName) {
      const file = bucket.file(objectPath);

      await file.save(buffer, {
        contentType,
        metadata: { metadata },
      });

      return {
        backend: 'gcs',
        objectPath,
        url: `https://storage.googleapis.com/${bucketName}/${objectPath}`,
      };
    }

    // Local fallback
    const fullPath = path.join(localBaseDir, objectPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return {
      backend: 'local',
      objectPath,
      localPath: fullPath,
    };
  }

  async function getFile(objectPath: string): Promise<Buffer> {
    if (bucket) {
      const [contents] = await bucket.file(objectPath).download();
      return contents as Buffer;
    }
    const fullPath = path.join(localBaseDir, objectPath);
    return fs.readFile(fullPath);
  }

  return {
    backend: useGcs ? 'gcs' : 'local',
    saveFile,
    getFile,
  };
}