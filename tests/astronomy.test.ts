/* ============================================
   ASTRONOMY ENGINE TESTS
   Reference values below were verified against
   real-world data: London's actual sunrise on the
   2024 summer solstice (2024-06-20) was ~03:43 UTC,
   and 2024-08-19 / 2024-08-04 are documented full
   and new moon dates. This catches real regressions,
   not just self-consistency with the algorithm.
============================================ */
import { describe, it, expect } from 'vitest';
import { getSunPosition, getSunTimes, getMoonData, phaseName } from '@/engine/astronomy';

const LONDON = { lat: 51.5074, lng: -0.1278 };
const EQUATOR = { lat: 0, lng: 0 };

describe('getSunPosition', () => {
  it('places the sun high in the sky at solar noon on the summer solstice', () => {
    // London, 2024-06-20, ~solar noon — sun should be well above the
    // horizon and close to its highest point of the year for this latitude.
    const noon = new Date('2024-06-20T12:00:00Z');
    const pos = getSunPosition(noon, LONDON.lat, LONDON.lng);
    const altitudeDeg = (pos.altitude * 180) / Math.PI;

    expect(altitudeDeg).toBeGreaterThan(55);
    expect(altitudeDeg).toBeLessThan(70);
  });

  it('places the sun below the horizon at midnight', () => {
    const midnight = new Date('2024-06-20T00:00:00Z');
    const pos = getSunPosition(midnight, LONDON.lat, LONDON.lng);
    expect(pos.altitude).toBeLessThan(0);
  });

  it('returns altitude and azimuth as finite numbers for any input', () => {
    const pos = getSunPosition(new Date(), LONDON.lat, LONDON.lng);
    expect(Number.isFinite(pos.altitude)).toBe(true);
    expect(Number.isFinite(pos.azimuth)).toBe(true);
  });
});

describe('getSunTimes', () => {
  it('matches London\'s real sunrise/sunset on the 2024 summer solstice within a few minutes', () => {
    const date = new Date('2024-06-20T12:00:00Z');
    const times = getSunTimes(date, LONDON.lat, LONDON.lng);

    // Real recorded sunrise: 03:44 UTC, sunset: 20:21 UTC.
    // A few minutes of tolerance accounts for atmospheric conditions
    // and the specific refraction model used, not algorithm error.
    const expectedSunrise = new Date('2024-06-20T03:44:00Z').getTime();
    const expectedSunset = new Date('2024-06-20T20:21:00Z').getTime();

    expect(Math.abs(times.sunrise.getTime() - expectedSunrise)).toBeLessThan(5 * 60 * 1000);
    expect(Math.abs(times.sunset.getTime() - expectedSunset)).toBeLessThan(5 * 60 * 1000);
  });

  it('keeps sunrise, solar noon, and sunset in correct chronological order', () => {
    const date = new Date('2024-06-20T12:00:00Z');
    const times = getSunTimes(date, LONDON.lat, LONDON.lng);

    expect(times.sunrise.getTime()).toBeLessThan(times.solarNoon.getTime());
    expect(times.solarNoon.getTime()).toBeLessThan(times.sunset.getTime());
  });

  it('nests twilight stages correctly around sunrise (astronomical < nautical < civil < sunrise)', () => {
    const date = new Date('2024-06-20T12:00:00Z');
    const times = getSunTimes(date, LONDON.lat, LONDON.lng);

    expect(times.astronomicalDawn.getTime()).toBeLessThan(times.nauticalDawn.getTime());
    expect(times.nauticalDawn.getTime()).toBeLessThan(times.civilDawn.getTime());
    expect(times.civilDawn.getTime()).toBeLessThan(times.sunrise.getTime());
  });

  it('produces a roughly 12-hour day at the equator on the equinox', () => {
    // Near the equinox, day length should be close to 12 hours
    // everywhere on Earth — a well-known astronomical sanity check.
    const date = new Date('2024-03-20T12:00:00Z');
    const times = getSunTimes(date, EQUATOR.lat, EQUATOR.lng);
    const dayLengthHours = (times.sunset.getTime() - times.sunrise.getTime()) / (1000 * 60 * 60);

    expect(dayLengthHours).toBeGreaterThan(11.8);
    expect(dayLengthHours).toBeLessThan(12.2);
  });
});

describe('getMoonData', () => {
  it('identifies a documented full moon date correctly', () => {
    // 2024-08-19 was a real, documented full moon.
    const date = new Date('2024-08-19T18:26:00Z');
    const moon = getMoonData(date, LONDON.lat, LONDON.lng);

    expect(moon.phase).toBeGreaterThan(0.47);
    expect(moon.phase).toBeLessThan(0.53);
    expect(moon.fraction).toBeGreaterThan(0.95); // nearly fully illuminated
  });

  it('identifies a documented new moon date correctly', () => {
    // 2024-08-04 was a real, documented new moon.
    const date = new Date('2024-08-04T11:13:00Z');
    const moon = getMoonData(date, LONDON.lat, LONDON.lng);

    const nearZeroOrOne = moon.phase < 0.03 || moon.phase > 0.97;
    expect(nearZeroOrOne).toBe(true);
    expect(moon.fraction).toBeLessThan(0.05); // nearly fully dark
  });

  it('keeps illuminated fraction within valid 0..1 bounds across a full month', () => {
    // Regression guard: a bug in the phase-angle math could push
    // fraction outside physically valid bounds without throwing.
    for (let day = 0; day < 30; day++) {
      const date = new Date(Date.UTC(2024, 7, 1 + day, 12, 0, 0));
      const moon = getMoonData(date, EQUATOR.lat, EQUATOR.lng);
      expect(moon.fraction).toBeGreaterThanOrEqual(0);
      expect(moon.fraction).toBeLessThanOrEqual(1);
    }
  });
});

describe('phaseName', () => {
  it('labels the boundary values correctly', () => {
    expect(phaseName(0)).toBe('New Moon');
    expect(phaseName(0.5)).toBe('Full Moon');
    expect(phaseName(0.99)).toBe('New Moon');
  });

  it('labels a quarter-phase value correctly', () => {
    expect(phaseName(0.25)).toBe('First Quarter');
    expect(phaseName(0.75)).toBe('Last Quarter');
  });
});
