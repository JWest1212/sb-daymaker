// Deterministic sunset time for a fixed lat/lng, pure math, no network, no AI.
// Implements the standard "Sunrise/Sunset Algorithm" (Almanac for Computers,
// 1990), accurate to ~1 minute, ample for the hero's golden-hour countdown
// chip. Trig is done in degrees to match the source formulae.

const RAD = Math.PI / 180;
const sinD = (d: number) => Math.sin(d * RAD);
const cosD = (d: number) => Math.cos(d * RAD);
const tanD = (d: number) => Math.tan(d * RAD);
const asinD = (x: number) => Math.asin(x) / RAD;
const acosD = (x: number) => Math.acos(x) / RAD;
const atanD = (x: number) => Math.atan(x) / RAD;
const mod = (x: number, m: number) => ((x % m) + m) % m;

/** Day of the year (1–366) for a Gregorian date. */
function dayOfYear(y: number, m: number, d: number): number {
  const n1 = Math.floor((275 * m) / 9);
  const n2 = Math.floor((m + 9) / 12);
  const n3 = 1 + Math.floor((y - 4 * Math.floor(y / 4) + 2) / 3);
  return n1 - n2 * n3 + d - 30;
}

/**
 * Sunset instant (epoch ms) for the given local calendar date at lat/lng.
 * Zenith 90.833° is official sunset (includes atmospheric refraction).
 *
 * The algorithm yields the UTC clock hour of sunset; for western longitudes
 * that instant lands on the *next* UTC calendar day, so we anchor to the local
 * date's UTC midnight + that hour and shift ±1 day until the candidate's
 * timezone-local date matches the intended day.
 */
export function sunsetMs(
  year: number,
  month: number, // 1–12
  day: number,
  lat: number,
  lng: number,
  tz = "America/Los_Angeles",
): number {
  const zenith = 90.833;
  const N = dayOfYear(year, month, day);
  const lngHour = lng / 15;

  const t = N + (18 - lngHour) / 24; // sunset uses the 18h approximation
  const M = 0.9856 * t - 3.289;

  let L = M + 1.916 * sinD(M) + 0.02 * sinD(2 * M) + 282.634;
  L = mod(L, 360);

  let RA = mod(atanD(0.91764 * tanD(L)), 360);
  // Put RA in the same quadrant as the Sun's true longitude L.
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
  RA /= 15; // degrees → hours

  const sinDec = 0.39782 * sinD(L);
  const cosDec = cosD(asinD(sinDec));
  const cosH = (cosD(zenith) - sinDec * sinD(lat)) / (cosDec * cosD(lat));

  let H = acosD(cosH); // sunset takes the positive hour angle
  H /= 15;

  const T = H + RA - 0.06571 * t - 6.622;
  const UT = mod(T - lngHour, 24); // sunset, hours UTC

  const target = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const base = Date.UTC(year, month - 1, day) + UT * 3_600_000;
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const off of [0, 86_400_000, -86_400_000]) {
    const cand = base + off;
    if (ymd.format(cand) === target) return cand;
  }
  return base;
}
