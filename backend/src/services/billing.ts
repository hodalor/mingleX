import { Setting } from "../models/Setting.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";

export const serviceCatalog = [
  { id: "likesYou", label: "See who likes you", detail: "The Requests list of people waiting for a yes or no." },
  { id: "matchChat", label: "Chat with matches", detail: "Open the conversation after you both match." },
  { id: "requestChat", label: "Chat before you match", detail: "Message someone while a request is still waiting." },
  { id: "readReceipts", label: "Read receipts", detail: "See when your last message was seen." },
  { id: "rewind", label: "Rewind", detail: "Undo the last swipe." },
  { id: "unlimitedLikes", label: "Unlimited likes", detail: "When this requires payment, other members get 20 likes a day." },
  { id: "superLike", label: "Super Like", detail: "A like that stands out in their requests." },
  { id: "boost", label: "Boost", detail: "Show the profile ahead of other nearby people for 30 minutes." },
  { id: "passport", label: "Passport", detail: "Save a discovery location." },
  { id: "hideAds", label: "Hide ads", detail: "Remove the Plus note from the deck." },
] as const;

export type ServiceId = (typeof serviceCatalog)[number]["id"];

const serviceIds = serviceCatalog.map((item) => item.id);

export async function paymentFlags(): Promise<Record<ServiceId, boolean>> {
  const stored = await Setting.findById("services").lean();
  const flags = {} as Record<ServiceId, boolean>;
  for (const id of serviceIds) {
    flags[id] = Boolean(stored?.[id]);
  }
  return flags;
}

export async function savePaymentFlags(partial: Partial<Record<ServiceId, boolean>>): Promise<Record<ServiceId, boolean>> {
  const update: Record<string, boolean> = {};
  for (const id of serviceIds) {
    if (partial[id] !== undefined) update[id] = partial[id];
  }
  await Setting.findByIdAndUpdate("services", { $set: update, $setOnInsert: { _id: "services" } }, { upsert: true });
  return paymentFlags();
}

export async function memberHasPaidAccess(userId: string): Promise<boolean> {
  const user = await User.findById(userId).select("paidAccess role");
  if (!user || user.role === "admin") return user?.role === "admin";
  return Boolean(user.paidAccess);
}

export async function canUse(userId: string, service: ServiceId): Promise<boolean> {
  const flags = await paymentFlags();
  if (!flags[service]) return true;
  return memberHasPaidAccess(userId);
}

export async function assertCanUse(userId: string, service: ServiceId): Promise<void> {
  if (await canUse(userId, service)) return;
  const item = serviceCatalog.find((entry) => entry.id === service);
  throw new HttpError(402, `${item?.label ?? "This"} is a paid feature.`);
}

export async function accessMap(userId: string): Promise<Record<ServiceId, boolean>> {
  const flags = await paymentFlags();
  const paid = await memberHasPaidAccess(userId);
  const access = {} as Record<ServiceId, boolean>;
  for (const id of serviceIds) {
    access[id] = !flags[id] || paid;
  }
  return access;
}
