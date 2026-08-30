/* ============================================
   DATE RANGE UTILITIES
   Determines the real window of dates with actual
   weather data available, and which data source
   (forecast vs. historical archive) a date needs.
   ============================================ */

import type { DateRange } from '@/types';

const FORECAST_DAYS_AHEAD = 15;
const ARCHIVE_LAG_DAYS = 5;
const EARLIEST_ARCHIVE_YEAR = 1940;

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** The real window of dates we can fetch genuine weather data for. */
export function getValidDateRange(): DateRange {
  const today = new Date();

  const minDate = new Date(`${EARLIEST_ARCHIVE_YEAR}-01-01`);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + FORECAST_DAYS_AHEAD);

  return {
    min: formatDate(minDate),
    max: formatDate(maxDate),
  };
}

/** True if a date is old enough that it needs the historical archive API. */
export function isArchiveDate(dateStr: string): boolean {
  const requested = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - ARCHIVE_LAG_DAYS);
  return requested < cutoff;
}

/** True if the given date string falls within the real valid range. */
export function isDateInValidRange(dateStr: string): boolean {
  const range = getValidDateRange();
  return dateStr >= range.min && dateStr <= range.max;
}

/** Today's date as YYYY-MM-DD, used as the sensible default. */
export function getTodayString(): string {
  return formatDate(new Date());
}
