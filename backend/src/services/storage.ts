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

/** Object name from a stored media path or absolute GCS URL. */
export function mediaObjectName(url: string): string | null {
  if (url.startsWith("/media/") || url.startsWith("/uploads/")) {
    const name = url.split("/").pop() ?? "";
    return name && !name.includes("..") ? name : null;
  }
  const match = url.match(/^https:\/\/storage\.googleapis\.com\/[^/]+\/([^/?#]+)/i);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return null;
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
    // Uniform bucket access often blocks object ACLs. Clients load via /media proxy instead.
  }
  // Always return an API-relative path so private buckets still display through Cloud Run.
  return `/media/${name}`;
}

export async function openGcsReadStream(name: string) {
  if (!gcsConfigured()) return null;
  const file = client().bucket(env.gcsBucket).file(name);
  const [exists] = await file.exists();
  if (!exists) return null;
  return file.createReadStream();
}

export async function deletePublicPhoto(url: string): Promise<void> {
  if (!gcsConfigured()) return;
  const name = mediaObjectName(url);
  if (!name) return;
  await client().bucket(env.gcsBucket).file(name).delete({ ignoreNotFound: true });
}
