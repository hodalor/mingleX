import { Storage } from "@google-cloud/storage";
import { env } from "../config/env.js";

let storage: Storage | null = null;

function credentialPair(): { email: string; key: string } {
  return {
    email: env.gcsClientEmail || env.firebaseClientEmail,
    key: env.gcsPrivateKey || env.firebasePrivateKey,
  };
}

export function gcsConfigured(): boolean {
  const credentials = credentialPair();
  return Boolean(env.gcsBucket && credentials.email && credentials.key);
}

function client(): Storage {
  if (!storage) {
    const credentials = credentialPair();
    storage = new Storage({
      projectId: env.gcsProjectId || env.firebaseProjectId || undefined,
      credentials: {
        client_email: credentials.email,
        private_key: credentials.key.replace(/\\n/g, "\n"),
      },
    });
  }
  return storage;
}

export async function uploadPublicPhoto(name: string, buffer: Buffer, contentType: string): Promise<string> {
  const file = client().bucket(env.gcsBucket).file(name);
  await file.save(buffer, {
    resumable: false,
    contentType,
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  try {
    await file.makePublic();
  } catch {
    // A bucket with uniform access uses its own public-read policy instead.
  }
  return `https://storage.googleapis.com/${env.gcsBucket}/${name}`;
}

export async function deletePublicPhoto(url: string): Promise<void> {
  if (!gcsConfigured()) return;
  const prefix = `https://storage.googleapis.com/${env.gcsBucket}/`;
  if (!url.startsWith(prefix)) return;
  const name = decodeURIComponent(url.slice(prefix.length));
  if (!name || name.includes("/") || name.includes("..")) return;
  await client().bucket(env.gcsBucket).file(name).delete({ ignoreNotFound: true });
}
