/** Builds and downloads an .ics calendar file for the event. */
import { INVITATION } from "@/config/invitation";

/** Parses "dd/mm/yyyy" + "HH:mm" + "+07:00" into a Date, or null while the date is a placeholder. */
export function eventDate(date: string, time: string, utcOffset: string): Date | null {
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const iso = `${d[3]}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}T${t[1].padStart(2, "0")}:${t[2]}:00${utcOffset}`;
  const out = new Date(iso);
  return Number.isNaN(out.getTime()) ? null : out;
}

/** "Thứ Bảy, 07/11/2026" — or the raw text while the date is still a placeholder. */
export function displayDate(): string {
  const e = INVITATION.event;
  const d = eventDate(e.date, e.start, e.utcOffset);
  if (!d) return e.date;
  const weekday = d.toLocaleDateString("vi-VN", { weekday: "long", timeZone: "Asia/Ho_Chi_Minh" });
  const [dd, mm, yyyy] = e.date.split("/");
  return `${weekday}, ${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`;
}

const stamp =(d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** RFC 5545 text escaping */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** RFC 5545 line folding (75 octets; UTF-8 aware so Vietnamese characters are never split). */
function fold(line: string) {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (enc.encode(cur + ch).length > limit) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(): string | null {
  const e = INVITATION.event;
  const start = eventDate(e.date, e.start, e.utcOffset);
  const end = eventDate(e.date, e.end, e.utcOffset);
  if (!start || !end) return null;
  const c = INVITATION.calendar;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//graduation-invite//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${stamp(start)}-graduation@xuanphu`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(c.title)}`,
    `LOCATION:${esc(`${e.place}, ${e.placeDetail}`)}`,
    `DESCRIPTION:${esc(`${c.description}\n${e.mapUrl}`)}`,
    `URL:${e.mapUrl}`,
  ];
  if (c.reminderMinutes > 0) {
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(c.title)}`, `TRIGGER:-PT${c.reminderMinutes}M`, "END:VALARM");
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Triggers the download; returns false while the date is not set yet. */
export function downloadIcs(): boolean {
  const ics = buildIcs();
  if (!ics) return false;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = INVITATION.calendar.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
