import { User } from "../models/User.js";

/** Active (not soft-deleted) account with this email. */
export async function findActiveByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return User.findOne({ email: normalized, deletedAt: null });
}

/** Active (not soft-deleted) account with this phone. */
export async function findActiveByPhone(phone: string) {
  const normalized = phone.trim();
  if (!normalized) return null;
  return User.findOne({ phone: normalized, deletedAt: null });
}
