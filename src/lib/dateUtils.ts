/**
 * Format a UTC datetime string from the backend into the user's local timezone.
 * The backend returns timestamps without "Z" suffix (e.g. "2026-07-12T05:55:06"),
 * so we append "Z" to treat them as UTC before converting to local time.
 */
export function formatLocalDateTime(utcString: string | null | undefined): string {
  if (!utcString) return "—";
  
  // Append Z if not already a full ISO string with timezone
  const normalised = utcString.endsWith("Z") || utcString.includes("+")
    ? utcString
    : utcString + "Z";

  try {
    return new Date(normalised).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return utcString;
  }
}

export function formatLocalDate(utcString: string | null | undefined): string {
  if (!utcString) return "—";
  const normalised = utcString.endsWith("Z") || utcString.includes("+")
    ? utcString
    : utcString + "Z";
  try {
    return new Date(normalised).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return utcString;
  }
}
