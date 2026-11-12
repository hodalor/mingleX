export function ageFromBirthDate(birthDate: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function parseBirthDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    const valid =
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day;
    if (!valid) {
      throw new Error("Invalid birth date");
    }
    return parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid birth date");
  }
  return parsed;
}

export function isAtLeast18(birthDate: Date, now = new Date()): boolean {
  return ageFromBirthDate(birthDate, now) >= 18;
}

export function birthDateBoundsForAges(minAge: number, maxAge: number, now = new Date()): { after: Date; through: Date } {
  return {
    after: new Date(Date.UTC(now.getUTCFullYear() - (maxAge + 1), now.getUTCMonth(), now.getUTCDate())),
    through: new Date(Date.UTC(now.getUTCFullYear() - minAge, now.getUTCMonth(), now.getUTCDate())),
  };
}
