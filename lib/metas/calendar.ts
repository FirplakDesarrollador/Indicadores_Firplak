// Calendario laboral de Colombia: lunes a viernes menos festivos (decisión del 2026-11-09).
// Los días laborales calculados son la propuesta; el valor que manda es el guardado en commercial_working_days.

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fromUtc(date: Date) {
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// Ley Emiliani (Ley 51 de 1983): el festivo que no cae en lunes se traslada al lunes siguiente.
function nextMonday(date: Date) {
  const offset = (8 - date.getUTCDay()) % 7;
  return addDays(date, offset);
}

// Domingo de Pascua (algoritmo anónimo gregoriano).
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const holidayCache = new Map<number, Set<string>>();

export function colombianHolidays(year: number) {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const utc = (month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
  const easter = easterSunday(year);
  const dates = [
    // Fijos
    utc(1, 1), utc(5, 1), utc(7, 20), utc(8, 7), utc(12, 8), utc(12, 25),
    // Trasladables al lunes
    nextMonday(utc(1, 6)), nextMonday(utc(3, 19)), nextMonday(utc(6, 29)), nextMonday(utc(8, 15)),
    nextMonday(utc(10, 12)), nextMonday(utc(11, 1)), nextMonday(utc(11, 11)),
    // Según la Pascua
    addDays(easter, -3), // Jueves Santo
    addDays(easter, -2), // Viernes Santo
    addDays(easter, 43), // Ascensión (lunes)
    addDays(easter, 64), // Corpus Christi (lunes)
    addDays(easter, 71), // Sagrado Corazón (lunes)
  ];
  const holidays = new Set(dates.map(fromUtc));
  holidayCache.set(year, holidays);
  return holidays;
}

export function isWorkingDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !colombianHolidays(year).has(date);
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthDates(year: number, month: number) {
  return Array.from({ length: daysInMonth(year, month) }, (_, index) => isoDate(year, month, index + 1));
}

export function suggestedWorkingDays(year: number, month: number) {
  return monthDates(year, month).filter(isWorkingDay).length;
}

// Fecha local del navegador en formato YYYY-MM-DD.
export function todayIso(now = new Date()) {
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
