/* ============================================
   APP ROOT
   Owns global state: selected location, date,
   time-of-day — and derives weather + astronomy
   data from it. Everything downstream reads from
   here, nothing fetches independently.
============================================ */
import { useState, useEffect, useMemo } from 'react';
import type { Location } from '@/types';
import { useWeather, getHourSlice } from '@/hooks/useWeather';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useDebounce } from '@/hooks/useDebounce';
import { getValidDateRange } from '@/utils/dateRange';

const DEFAULT_MINUTES = 12 * 60; // noon, sensible first paint

export default function App() {
  const dateRange = useMemo(() => getValidDateRange(), []);

  const [location, setLocation] = useState<Location | null>(null);
  const [date, setDate] = useState<string>(dateRange.max);
  const [minutes, setMinutes] = useState<number>(DEFAULT_MINUTES);

  const geo = useGeolocation();
  const weather = useWeather();

  // Slider/search inputs get debounced before they trigger a fetch —
  // this is what makes dragging through a day feel smooth instead of
  // firing a request on every pixel of movement.
  const debouncedDate = useDebounce(date, 300);
  const debouncedMinutes = useDebounce(minutes, 300);

  // On first mount, try to detect the user's real location.
  // Falls back to Tokyo inside useGeolocation if detection fails.
  useEffect(() => {
    geo.detect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Once we have a location, adopt it as the active one.
  useEffect(() => {
    if (geo.location) {
      setLocation(geo.location);
    }
  }, [geo.location]);

  // Fetch weather whenever the *settled* location/date changes.
  // Time-of-day (minutes) doesn't need a new fetch — it's used to
  // slice the same day's hourly data, so it's handled separately below.
  useEffect(() => {
    if (location) {
      weather.fetchWeather(location.lat, location.lng, debouncedDate);
    }
  }, [location, debouncedDate, weather.fetchWeather]);

  // Slice the fetched day's hourly data down to the selected hour.
  const hourIndex = Math.floor(debouncedMinutes / 60);
  const hourData = useMemo(
    () => getHourSlice(weather.hourly, hourIndex),
    [weather.hourly, hourIndex]
  );

  return (
    <div className="app-root">
      {/* SkyCanvas, ControlDeck, InfoPanel, Watermark, SoundToggle,
          LoadingState all mount here in upcoming steps — this shell
          intentionally has no visual markup yet, only wiring. */}
      <pre style={{ color: '#7fd6ff', fontSize: 12, padding: 16 }}>
        {JSON.stringify(
          {
            location,
            geoStatus: geo.status,
            geoMessage: geo.message,
            date,
            minutes,
            weatherLoading: weather.loading,
            weatherError: weather.error,
            hourData,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}
