/* ============================================
   APP ROOT
   Owns global state: selected location, date,
   time-of-day — derives astronomy + weather from
   it, and passes the combined render state down
   to SkyCanvas. Nothing downstream fetches or
   computes independently; everything flows from
   here in one direction.
============================================ */
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Location, SkyRenderState } from '@/types';
import { useWeather, getHourSlice } from '@/hooks/useWeather';
import { useGeolocation } from '@/hooks/useGeolocation';
import { getValidDateRange } from '@/utils/dateRange';
import { getSunPosition, getSunTimes, getMoonData } from '@/engine/astronomy';

import SkyCanvas from '@/components/SkyCanvas';
import ControlDeck from '@/components/ControlDeck';
import InfoPanel from '@/components/InfoPanel';
import Watermark from '@/components/Watermark';
import SoundToggle from '@/components/SoundToggle';
import LoadingState from '@/components/LoadingState';

const DEFAULT_MINUTES = 12 * 60; // noon, a sensible first paint

function minutesToDate(dateStr: string, minutes: number): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setHours(0, minutes, 0, 0);
  return d;
}

export default function App() {
  const dateRange = useMemo(() => getValidDateRange(), []);

  const [location, setLocation] = useState<Location | null>(null);
  const [date, setDate] = useState<string>(dateRange.max);
  const [minutes, setMinutes] = useState<number>(DEFAULT_MINUTES);

  const geo = useGeolocation();
  const weather = useWeather();

  // Detect location once on mount. useGeolocation already falls back
  // to Tokyo internally if detection fails — App doesn't need its
  // own fallback logic duplicated here.
  useEffect(() => {
    geo.detect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (geo.location) setLocation(geo.location);
  }, [geo.location]);

  // Weather fetches on location/date change — useWeather's own
  // abort-before-cache-check logic (fixed earlier) handles rapid
  // location switching safely, so App just calls it plainly.
  useEffect(() => {
    if (location) {
      weather.fetchWeather(location.lat, location.lng, date);
    }
  }, [location, date, weather.fetchWeather]);

  const hourIndex = Math.floor(minutes / 60);
  const hourData = useMemo(
    () => getHourSlice(weather.hourly, hourIndex),
    [weather.hourly, hourIndex]
  );

  // Astronomy is pure math — cheap enough to recompute on every
  // minutes/date/location change without memoizing more aggressively
  // than useMemo already gives us.
  const momentDate = useMemo(() => minutesToDate(date, minutes), [date, minutes]);

  const sunPosition = useMemo(
    () => (location ? getSunPosition(momentDate, location.lat, location.lng) : null),
    [momentDate, location]
  );

  const sunTimes = useMemo(
    () => (location ? getSunTimes(momentDate, location.lat, location.lng) : null),
    [momentDate, location]
  );

  const moon = useMemo(
    () => (location ? getMoonData(momentDate, location.lat, location.lng) : null),
    [momentDate, location]
  );

  // The single combined render state SkyCanvas needs — this is the
  // one place astronomy and weather data actually meet.
  const skyState: SkyRenderState = useMemo(
    () => ({
      sunAltitude: sunPosition?.altitude ?? -1,
      sunAzimuth: sunPosition?.azimuth ?? 0,
      moonAltitude: moon?.altitude ?? -1,
      moonAzimuth: moon?.azimuth ?? 0,
      moonPhase: moon?.phase ?? 0,
      condition: hourData.condition,
      cloudcover: hourData.cloudcover,
      precipitation: hourData.precipitation,
      visibility: hourData.visibility,
      windspeed: hourData.windspeed,
      winddirection: hourData.winddirection,
    }),
    [sunPosition, moon, hourData]
  );

  const handleLocationSelect = useCallback((loc: Location) => {
    setLocation(loc);
  }, []);

  const isInitialLoading = geo.status === 'idle' || geo.status === 'locating';

  return (
    <div className="app-root">
      <SkyCanvas state={skyState} />

      {isInitialLoading && <LoadingState phase="locating" message={geo.message} />}

      {!isInitialLoading && weather.loading && !weather.hourly && (
        <LoadingState phase="loading" />
      )}

      {!isInitialLoading && weather.error && (
        <LoadingState
          phase="error"
          message={weather.error}
          onRetry={() => location && weather.fetchWeather(location.lat, location.lng, date)}
        />
      )}

      <InfoPanel
        location={location}
        sunTimes={sunTimes}
        moon={moon}
        weather={hourData}
        loading={weather.loading && !weather.hourly}
        error={weather.error}
      />

      <ControlDeck
        location={location}
        onLocationSelect={handleLocationSelect}
        date={date}
        onDateChange={setDate}
        dateRange={dateRange}
        minutes={minutes}
        onMinutesChange={setMinutes}
        onUseMyLocation={geo.detect}
        geoStatus={geo.status}
      />

      <SoundToggle />
      <Watermark sunAltitude={skyState.sunAltitude} />
    </div>
  );
}
