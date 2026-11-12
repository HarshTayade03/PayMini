/**
 * Centralized minor unit (paise) <-> display format conversions in frontend.
 */

export function formatPaiseToDisplay(paise: number): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainder = absPaise % 100;
  const formattedCents = remainder.toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}${rupees.toLocaleString("en-IN")}.${formattedCents}`;
}

export function parseDisplayToPaise(displayStr: string): number {
  const cleaned = displayStr.replace(/,/g, "").trim();
  const parts = cleaned.split(".");
  if (parts.length === 1) {
    const rupees = parseInt(parts[0], 10);
    if (isNaN(rupees)) throw new Error("Invalid number");
    return rupees * 100;
  } else if (parts.length === 2) {
    const rupees = parseInt(parts[0], 10);
    const paise = parseInt(parts[1].slice(0, 2).padEnd(2, "0"), 10);
    if (isNaN(rupees) || isNaN(paise)) throw new Error("Invalid number");
    return rupees * 100 + paise;
  }
  throw new Error("Invalid monetary string");
}

export function formatDate(isoDateStr: string): string {
  try {
    const d = new Date(isoDateStr);
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return isoDateStr;
  }
}
