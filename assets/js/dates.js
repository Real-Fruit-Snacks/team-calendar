export const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

export function pad2(n) { return String(n).padStart(2, '0'); }

export function toISO(year, monthIndex0, day) {
  return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`;
}

export function todayISO(now = new Date()) {
  return toISO(now.getFullYear(), now.getMonth(), now.getDate());
}

export function monthGrid(year, monthIndex0) {
  const firstDow = new Date(year, monthIndex0, 1).getDay(); // 0 = Sunday
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const offset = w * 7 + d - firstDow;
      const cur = new Date(year, monthIndex0, 1 + offset);
      week.push({
        iso: toISO(cur.getFullYear(), cur.getMonth(), cur.getDate()),
        day: cur.getDate(),
        inMonth: cur.getMonth() === monthIndex0 && cur.getFullYear() === year,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

export function monthLabel(year, monthIndex0) {
  return `${MONTHS[monthIndex0]} ${year}`;
}

export function addMonths(year, monthIndex0, delta) {
  const base = new Date(year, monthIndex0 + delta, 1);
  return { year: base.getFullYear(), month: base.getMonth() };
}
