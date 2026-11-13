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

function recaptcha(): RecaptchaVerifier {
  if (verifier) return verifier;
  verifier = new RecaptchaVerifier(auth, "phone-recaptcha", { size: "invisible" });
  return verifier;
}

export async function sendFirebaseSms(phone: string): Promise<void> {
  try {
    pending = await signInWithPhoneNumber(auth, phone, recaptcha());
  } catch (error) {
    verifier?.clear();
    verifier = null;
    pending = null;
    throw error;
  }
}

export async function confirmFirebaseSms(code: string): Promise<string> {
  if (!pending) throw new Error("Send the code to your number first");
  const result = await pending.confirm(code);
  pending = null;
  const idToken = await result.user.getIdToken();
  return idToken;
}

export function firebaseError(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "auth/invalid-phone-number") return "That phone number is not valid";
  if (code === "auth/too-many-requests") return "Too many tries. Wait a moment and try again";
  if (code === "auth/invalid-verification-code") return "That code is not right";
  if (code === "auth/code-expired") return "That code has expired. Send a new one";
  if (error instanceof Error && error.message) return error.message;
  return "Phone verification did not go through";
}
