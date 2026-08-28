/* ============================================
   APP ROOT
   Owns global state: selected location, date,
   time-of-day — derives weather + astronomy
   data from it. Downstream components read from
   here; nothing fetches independently.
============================================ */
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Location } from '@/types';
import { useWeather, getHourSlice } from '@/hooks/useWeather';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useDebounce } from '@/hooks/useDebounce';
import { getValidDateRange } from '@/utils/dateRange';

const DEFAULT_MINUTES = 12 * 60; // noon — sensible first paint, mid-day light

export default function App() {
  const dateRange = useMemo(() => getValidDateRange(), []);

  const [location, setLocation] = useState<Location | null>(null);
  const [date, setDate] = useState<string>(dateRange.max);
  const [minutes, setMinutes] = useState<number>(DEFAULT_MINUTES);

  const geo = useGeolocation();
  const weather = useWeather();

  // Debounced before triggering a fetch, so dragging the slider through
  // a full day fires one request 300ms after release, not one per pixel.
  const debouncedDate = useDebounce(date, 300);
  const debouncedMinutes = useDebounce(minutes, 300);

  useEffect(() => {
    geo.detect();
    // Runs once on mount only — detect() is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (geo.location && !location) {
      setLocation(geo.location);
    }
  }, [geo.location, location]);

  useEffect(() => {
    if (!location) return;
    weather.fetchWeather(location.lat, location.lng, debouncedDate);
  }, [location, debouncedDate, weather.fetchWeather]);

  const hourIndex = Math.floor(debouncedMinutes / 60);
  const hourData = useMemo(
    () => getHourSlice(weather.hourly, hourIndex),
    [weather.hourly, hourIndex]
  );

  const selectLocation = useCallback((next: Location) => {
    setLocation(next);
  }, []);

  const isReady = Boolean(location) && !weather.loading;

  // SkyCanvas, ControlDeck, InfoPanel, Watermark, SoundToggle, and
  // LoadingState mount here starting next step. Intentionally renders
  // nothing until there's something real to paint — no placeholder markup.
  if (!isReady) {
    return null;
  }

  return null;
}
