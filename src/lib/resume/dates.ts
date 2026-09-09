/**
 * Partial-date utilities. Resume dates are commonly year or year-month; we
 * never force full ISO dates (§127). All functions treat "" / null as unknown.
 */

export interface ParsedDate {
  year: number;
  month?: number; // 1-12
  day?: number;
}

export function cleanDate(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s === "" ? undefined : s;
}

export function parsePartialDate(input: string | null | undefined): ParsedDate | null {
  if (!input) return null;
  const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : undefined;
  const day = m[3] ? Number(m[3]) : undefined;
  if (year < 1500 || year > 2200) return null;
  if (month !== undefined && (month < 1 || month > 12)) return null;
  if (day !== undefined && (day < 1 || day > 31)) return null;
  return { year, month, day };
}

export function isValidPartialDate(input: string | null | undefined): boolean {
  return parsePartialDate(input) !== null;
}

/** Ordinal for comparisons; day precision per month length assumption. */
export function dateToOrdinal(d: ParsedDate): number {
  const month = d.month ?? 12; // "2020" as a start means January, as end means December — callers choose
  const day = d.day ?? 28;
  return d.year * 10000 + month * 100 + day;
}

export function startOrdinal(input: string | null | undefined): number | null {
  const d = parsePartialDate(input);
  if (!d) return null;
  return dateToOrdinal({ ...d, month: d.month ?? 1, day: d.day ?? 1 });
}

export function endOrdinal(input: string | null | undefined, isCurrent = false): number | null {
  if (isCurrent) return Number.MAX_SAFE_INTEGER;
  const d = parsePartialDate(input);
  if (!d) return null;
  return dateToOrdinal({ ...d, month: d.month ?? 12, day: d.day ?? 31 });
}

export function formatPartialDate(
  input: string | null | undefined,
  opts?: { short?: boolean },
): string {
  const d = parsePartialDate(input);
  if (!d) return input ? String(input) : "";
  if (d.month && !opts?.short) {
    return `${MONTHS[d.month - 1]} ${d.year}` + (d.day ? `, ${d.day}` : "");
  }
  if (d.month) return `${SHORT_MONTHS[d.month - 1]} ${d.year}`;
  return `${d.year}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatRange(
  start: string | null | undefined,
  end: string | null | undefined,
  current = false,
): string {
  const s = formatPartialDate(start, { short: true });
  const e = current ? "Present" : formatPartialDate(end, { short: true });
  if (!s && !e) return "";
  if (!s) return e;
  if (!e) return s;
  return `${s} — ${e}`;
}

export function monthsBetween(
  start: string | null | undefined,
  end: string | null | undefined,
  isCurrent = false,
): number | null {
  const so = startOrdinal(start);
  const eo = endOrdinal(end, isCurrent);
  if (so === null || eo === null) return null;
  if (eo === Number.MAX_SAFE_INTEGER) {
    const now = new Date();
    return Math.max(
      0,
      now.getFullYear() * 12 +
        now.getMonth() -
        Math.floor(so / 10000) * 12 -
        (Math.floor(so / 100) % 100) +
        1,
    );
  }
  const sy = Math.floor(so / 10000);
  const sm = Math.floor(so / 100) % 100;
  const ey = Math.floor(eo / 10000);
  const em = Math.floor(eo / 100) % 100;
  return Math.max(0, (ey - sy) * 12 + (em - sm) + 1);
}

export interface DateIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

/** §127 — validation without false alarms on legitimate overlaps. */
export function validateExperienceDates(
  start: string | null | undefined,
  end: string | null | undefined,
  current: boolean,
  ctx: { today?: Date } = {},
): DateIssue[] {
  const issues: DateIssue[] = [];
  const today = ctx.today ?? new Date();
  if (!start && !current) {
    issues.push({ level: "warning", code: "MISSING_START", message: "Start date is missing." });
  }
  if (!start) return issues;
  const s = parsePartialDate(start);
  if (!s) {
    issues.push({
      level: "error",
      code: "INVALID_START",
      message: `Start date "${start}" is not a valid year or year-month.`,
    });
    return issues;
  }
  const futureStart =
    startOrdinal(start)! >
    dateToOrdinal({ year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() });
  if (futureStart) {
    issues.push({
      level: "warning",
      code: "FUTURE_START",
      message: "Start date is in the future.",
    });
  }
  if (!current) {
    if (!end) {
      issues.push({
        level: "warning",
        code: "MISSING_END",
        message: "End date is missing for a past role.",
      });
      return issues;
    }
    const e = parsePartialDate(end);
    if (!e) {
      issues.push({
        level: "error",
        code: "INVALID_END",
        message: `End date "${end}" is not a valid year or year-month.`,
      });
      return issues;
    }
    if (endOrdinal(end)! < startOrdinal(start)!) {
      issues.push({
        level: "error",
        code: "REVERSED",
        message: "End date is before the start date.",
      });
    }
  } else if (end) {
    issues.push({
      level: "warning",
      code: "END_WITH_CURRENT",
      message: 'Role marked "current" also has an end date.',
    });
  }
  return issues;
}

export function overlaps(
  a: { start?: string | null; end?: string | null; current?: boolean },
  b: { start?: string | null; end?: string | null; current?: boolean },
): boolean {
  const as = startOrdinal(a.start);
  const ae = endOrdinal(a.end, a.current);
  const bs = startOrdinal(b.start);
  const be = endOrdinal(b.current ? undefined : b.end, b.current);
  const aEnd = a.current ? Number.MAX_SAFE_INTEGER : ae;
  const bEnd = b.current ? Number.MAX_SAFE_INTEGER : be;
  if (as === null || aEnd === null || bs === null || bEnd === null) return false;
  return as <= bEnd && bs <= aEnd;
}
