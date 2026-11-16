const CLOUD_RUN_API = "https://minglex-31319355631.europe-west9.run.app";
const fromEnv = String(import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fromEnv);
// Production must never call localhost — ignore a mis-set Netlify env pointing at :4000.
export const API_URL =
  import.meta.env.PROD
    ? fromEnv && !isLocal
      ? fromEnv
      : CLOUD_RUN_API
    : fromEnv || "http://localhost:4000";

export function mediaUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url}`;
}

export async function uploadPhoto(file: File, token: string) {
  return uploadFile("/api/me/photos", file, token);
}

export async function uploadFile(path: string, file: File, token: string) {
  const body = new FormData();
  body.append("photo", file);
  return api<{ user: Me }>(path, { method: "POST", body }, token);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type Me = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  age: number | null;
  gender: string;
  needsOnboarding: boolean;
  providers: string[];
  profileIncomplete: boolean;
};

export type AuthResult = {
  token: string;
  user: Me;
  needsOnboarding: boolean;
};

export type ProviderConfig = {
  google: boolean;
  apple: boolean;
  googleClientId: string | null;
  appleClientId: string | null;
  sms: boolean;
  firebase: boolean;
  email: boolean;
  devPreview: boolean;
};

export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "Can't reach the mingleX API. Start the backend and check MongoDB Atlas.");
  }

  const data = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new ApiError(response.status, data.message ?? "Request failed");
  }
  return data as T;
}
