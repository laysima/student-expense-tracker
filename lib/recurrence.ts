// Pure date maths for recurring entries. Everything works on 'YYYY-MM-DD'
// strings in UTC so the server's timezone can never shift a due date.

function parts(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return { year, month, day }
}

function format(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Today's calendar date for someone in `timeZone`. */
export function localIsoDate(now: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

/**
 * The nth occurrence after `anchor`. Monthly and yearly cycles count from the
 * anchor rather than from the previous occurrence, so a bill on the 31st lands
 * on Feb 28 and is back on Mar 31 instead of drifting to the 28th for good.
 */
export function nthOccurrence(anchor: string, cycle: string | null, n: number) {
  const { year, month, day } = parts(anchor)
  if (cycle === 'weekly' || cycle === 'biweekly') {
    const date = new Date(Date.UTC(year, month - 1, day + n * (cycle === 'weekly' ? 7 : 14)))
    return format(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }
  const monthsAhead = cycle === 'yearly' ? n * 12 : n
  const index = month - 1 + monthsAhead
  const targetYear = year + Math.floor(index / 12)
  const targetMonth = (index % 12) + 1
  return format(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)))
}

/** Occurrences strictly after `after`, up to and including `today`. */
export function dueOccurrences(anchor: string, cycle: string | null, after: string, today: string, limit = 24) {
  const due: string[] = []
  for (let n = 1; due.length < limit; n++) {
    const date = nthOccurrence(anchor, cycle, n)
    if (date > today) break
    if (date > after) due.push(date)
    if (n > 1000) break
  }
  return due
}
