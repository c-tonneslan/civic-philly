// pg dates come through lib/db.ts as raw ISO-ish strings (the type
// parsers are disabled) so we don't have to worry about a UTC shift here.
// Pull the calendar parts out of "YYYY-MM-DD" directly to skip the Date
// constructor, which would otherwise parse a bare date as UTC midnight
// and then format one day off in any negative-offset zone.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatYMD(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const month = MONTHS[parseInt(m[2], 10) - 1];
  if (!month) return s;
  return `${month} ${parseInt(m[3], 10)}, ${m[1]}`;
}
