import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAXZF7wgHpIeeRwZlEqWUJDWm8aN1isjQo",
  authDomain: "minglex-537b4.firebaseapp.com",
  projectId: "minglex-537b4",
  storageBucket: "minglex-537b4.firebasestorage.app",
  messagingSenderId: "31319355631",
  appId: "1:31319355631:web:4e2dc5ddcb1ab94bbc2b1a",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let verifier: RecaptchaVerifier | null = null;
let pending: ConfirmationResult | null = null;

function clearVerifier() {
  try {
    verifier?.clear();
  } catch {
    // Ignore double-clear during retries.
  }
  verifier = null;
}

function makeVerifier(size: "invisible" | "normal"): RecaptchaVerifier {
  clearVerifier();
  const container = document.getElementById("phone-recaptcha");
  if (container) container.innerHTML = "";
  verifier = new RecaptchaVerifier(auth, "phone-recaptcha", { size });
  return verifier;
}

export async function sendFirebaseSms(phone: string): Promise<void> {
  try {
    pending = await signInWithPhoneNumber(auth, phone, makeVerifier("invisible"));
  } catch (first) {
    // Invisible reCAPTCHA often fails on new Netlify domains; fall back to a visible challenge.
    try {
      pending = await signInWithPhoneNumber(auth, phone, makeVerifier("normal"));
    } catch {
      clearVerifier();
      pending = null;
      throw first;
    }
  }
}

export async function confirmFirebaseSms(code: string): Promise<string> {
  if (!pending) throw new Error("Send the code to your number first");
  const result = await pending.confirm(code);
  pending = null;
  clearVerifier();
  const idToken = await result.user.getIdToken();
  return idToken;
}

export function firebaseError(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  const blob = `${code} ${message}`.toLowerCase();
  if (code === "auth/invalid-phone-number") return "That phone number is not valid";
  if (code === "auth/too-many-requests") return "Too many tries. Wait a moment and try again";
  if (code === "auth/invalid-verification-code") return "That code is not right";
  if (code === "auth/code-expired") return "That code has expired. Send a new one";
  if (code === "auth/network-request-failed" || blob.includes("503")) {
    return "Phone verification is temporarily unavailable. Try again in a minute, or continue with email only.";
  }
  if (
    blob.includes("error-code:-39")
    || blob.includes("captcha")
    || code === "auth/captcha-check-failed"
    || code === "auth/argument-error"
  ) {
    return "Phone verification was blocked. Add this site in Firebase Authorized domains, complete the captcha if shown, then try again — or leave phone blank and use email only.";
  }
  if (message) return message;
  return "Phone verification did not go through";
}
