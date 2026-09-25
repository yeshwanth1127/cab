/**
 * Outstation round / multi-way: inclusive calendar-day helpers (local timezone).
 * Used for default return datetime in the UI — does not affect fare APIs.
 */

function toISOLocal(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${min}`;
}

function roundTo15Min(date) {
  const d = new Date(date);
  const m = d.getMinutes();
  const rounded = Math.floor(m / 15) * 15;
  d.setMinutes(rounded, 0, 0);
  return d;
}

/**
 * Inclusive calendar days between pickup and return (local dates).
 * Same calendar day → 1; 10th → 12th → 3.
 */
export function calendarInclusiveDaysBetween(startIso, endIso) {
  try {
    if (!startIso || !endIso) return null;
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (end.getTime() <= start.getTime()) return null;
    const s0 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e0 = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const deltaDays = Math.round((e0 - s0) / (24 * 60 * 60 * 1000));
    return Math.max(1, deltaDays + 1);
  } catch {
    return null;
  }
}

/**
 * Default return datetime for N inclusive calendar days from pickup:
 * last day = pickup local date + (N - 1), same local time as pickup.
 * N === 1: same calendar day, shortly after pickup (15 min, aligned to 15 min slots).
 */
export function defaultReturnDatetimeFromPickupAndCalendarDays(pickupIso, numDays) {
  const n = Math.floor(Number(numDays));
  if (!pickupIso || !Number.isFinite(n) || n < 1) return null;
  const start = new Date(pickupIso);
  if (Number.isNaN(start.getTime())) return null;

  const y = start.getFullYear();
  const m = start.getMonth();
  const d = start.getDate();
  const h = start.getHours();
  const min = start.getMinutes();

  let end;
  if (n === 1) {
    end = new Date(start.getTime() + 15 * 60 * 1000);
    roundTo15Min(end);
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 15 * 60 * 1000);
    }
  } else {
    end = new Date(y, m, d + (n - 1), h, min, 0, 0);
  }

  if (end.getTime() <= start.getTime()) return null;
  return toISOLocal(end);
}
