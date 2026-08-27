/* ============================================
   ASTRONOMY ENGINE
   Real solar & lunar position math, sunrise/sunset,
   three-stage twilight, and moon phase — with
   atmospheric refraction correction near the horizon.
   Formulas adapted from standard NOAA/Meeus solar
   and lunar position algorithms.
   ============================================ */

import type { SunPosition, SunTimes, MoonData } from '@/types';

const RAD = Math.PI / 180;
const DAY_MS = 1000 * 60 * 60 * 24;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

function toJulian(date: Date): number {
  return date.valueOf() / DAY_MS - 0.5 + J1970;
}

function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * DAY_MS);
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

// --- Sun ---

function solarMeanAnomaly(d: number): number {
  return RAD * (357.5291 + 0.98560028 * d);
}

function eclipticLongitude(M: number): number {
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372;
  return M + C + P + Math.PI;
}

function sunCoords(d: number) {
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  return {
    dec: Math.asin(Math.sin(OBLIQUITY) * Math.sin(L)),
    ra: Math.atan2(Math.cos(OBLIQUITY) * Math.sin(L), Math.cos(L)),
    M,
    L,
  };
}

function siderealTime(d: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * d) - lw;
}

function azimuthFromHour(H: number, phi: number, dec: number): number {
  return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
}

function altitudeFromHour(H: number, phi: number, dec: number): number {
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
}

// Atmospheric refraction bends light near the horizon, making the sun/moon
// appear slightly higher than their true geometric position. This is why
// real sunsets look different from the raw math — we correct for it here.
function applyRefraction(trueAltitude: number): number {
  const altDeg = trueAltitude / RAD;
  if (altDeg > 15) return trueAltitude;
  if (altDeg > -1) {
    const R = 1.02 / Math.tan(RAD * (altDeg + 10.3 / (altDeg + 5.11)));
    return trueAltitude + RAD * (R / 60);
  }
  return trueAltitude;
}

export function getSunPosition(date: Date, lat: number, lng: number): SunPosition {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(date);
  const c = sunCoords(d);
  const H = siderealTime(d, lw) - c.ra;

  const trueAltitude = altitudeFromHour(H, phi, c.dec);

  return {
    azimuth: azimuthFromHour(H, phi, c.dec),
    altitude: applyRefraction(trueAltitude),
  };
}

// --- Sunrise / sunset / twilight ---

const J0 = 0.0009;

function julianCycle(d: number, lw: number): number {
  return Math.round(d - J0 - lw / (2 * Math.PI));
}

function approxTransit(Ht: number, lw: number, n: number): number {
  return J0 + (Ht + lw) / (2 * Math.PI) + n;
}

function solarTransitJ(ds: number, M: number, L: number): number {
  return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
}

function hourAngle(h: number, phi: number, dec: number): number {
  return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
}

function getSetJ(h: number, lw: number, phi: number, dec: number, n: number, M: number, L: number): number {
  const w = hourAngle(h, phi, dec);
  const a = approxTransit(w, lw, n);
  return solarTransitJ(a, M, L);
}

function computeTimesForAngle(
  angleDeg: number,
  lw: number,
  phi: number,
  n: number,
  M: number,
  L: number,
  dec: number,
  Jnoon: number
): { rise: Date; set: Date } {
  const h0 = angleDeg * RAD;
  const Jset = getSetJ(h0, lw, phi, dec, n, M, L);
  const Jrise = Jnoon - (Jset - Jnoon);
  return { rise: fromJulian(Jrise), set: fromJulian(Jset) };
}

export function getSunTimes(date: Date, lat: number, lng: number): SunTimes {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const c = sunCoords(ds);
  const Jnoon = solarTransitJ(ds, c.M, c.L);

  const solarNoon = fromJulian(Jnoon);

  const civil = computeTimesForAngle(-6, lw, phi, n, c.M, c.L, c.dec, Jnoon);
  const nautical = computeTimesForAngle(-12, lw, phi, n, c.M, c.L, c.dec, Jnoon);
  const astronomical = computeTimesForAngle(-18, lw, phi, n, c.M, c.L, c.dec, Jnoon);
  const sunriseSunset = computeTimesForAngle(-0.833, lw, phi, n, c.M, c.L, c.dec, Jnoon);

  return {
    sunrise: sunriseSunset.rise,
    sunset: sunriseSunset.set,
    solarNoon,
    civilDawn: civil.rise,
    civilDusk: civil.set,
    nauticalDawn: nautical.rise,
    nauticalDusk: nautical.set,
    astronomicalDawn: astronomical.rise,
    astronomicalDusk: astronomical.set,
  };
}

// --- Moon ---

function moonCoords(d: number) {
  const L = RAD * (218.316 + 13.176396 * d);
  const M = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.229350 * d);

  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  const dt = 385001 - 20905 * Math.cos(M);

  const ra = Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));

  return { ra, dec, dist: dt, l, b };
}

export function getMoonData(date: Date, lat: number, lng: number): MoonData {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(date);

  const m = moonCoords(d);
  const H = siderealTime(d, lw) - m.ra;

  const trueAltitude = altitudeFromHour(H, phi, m.dec);
  const altitude = applyRefraction(trueAltitude);
  const azimuth = azimuthFromHour(H, phi, m.dec);

  const s = sunCoords(d);
  const sdist = 149598000;
  const phi2 = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec) +
    Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra)
  );
  const inc = Math.atan2(sdist * Math.sin(phi2), m.dist - sdist * Math.cos(phi2));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra)
  );

  const phase = 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI;
  const fraction = (1 + Math.cos(inc)) / 2;

  return { phase, angle, fraction, altitude, azimuth };
}

export function phaseName(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}
