/* ============================================
   useWeather HOOK
   Fetches weather via our serverless proxy with
   proper request cancellation — this is what
   prevents stale/out-of-order responses from
   corrupting the UI during rapid interaction.
   ============================================ */

import { useState, useRef, useCallback } from 'react';
import type { WeatherHour, WeatherHourlyRaw, WeatherCondition } from '@/types';

interface WeatherState {
  hourly: WeatherHourlyRaw | null;
  dataAvailable: boolean;
  loading: boolean;
  error: string | null;
}

const WMO_MAP: Record<number, { category: WeatherCondition; label: string }> = {
  0: { category: 'clear', label: 'Clear sky' },
  1: { category: 'mostly-clear', label: 'Mostly clear' },
  2: { category: 'partly-cloudy', label: 'Partly cloudy' },
  3: { category: 'overcast', label: 'Overcast' },
  45: { category: 'fog', label: 'Fog' },
  48: { category: 'fog', label: 'Depositing rime fog' },
  51: { category: 'drizzle', label: 'Light drizzle' },
  53: { category: 'drizzle', label: 'Drizzle' },
  55: { category: 'drizzle', label: 'Dense drizzle' },
  56: { category: 'drizzle', label: 'Freezing drizzle' },
  57: { category: 'drizzle', label: 'Freezing drizzle' },
  61: { category: 'rain', label: 'Light rain' },
  63: { category: 'rain', label: 'Rain' },
  65: { category: 'rain', label: 'Heavy rain' },
  66: { category: 'rain', label: 'Freezing rain' },
  67: { category: 'rain', label: 'Freezing rain' },
  71: { category: 'snow', label: 'Light snow' },
  73: { category: 'snow', label: 'Snow' },
  75: { category: 'snow', label: 'Heavy snow' },
  77: { category: 'snow', label: 'Snow grains' },
  80: { category: 'rain', label: 'Rain showers' },
  81: { category: 'rain', label: 'Rain showers' },
  82: { category: 'rain', label: 'Violent rain showers' },
  85: { category: 'snow', label: 'Snow showers' },
  86: { category: 'snow', label: 'Heavy snow showers' },
  95: { category: 'storm', label: 'Thunderstorm' },
  96: { category: 'storm', label: 'Thunderstorm with hail' },
  99: { category: 'storm', label: 'Thunderstorm with heavy hail' },
};

function decodeWeatherCode(code: number) {
  return WMO_MAP[code] || { category: 'clear' as WeatherCondition, label: 'Clear sky' };
}

export function getHourSlice(hourly: WeatherHourlyRaw | null, hourIndex: number): WeatherHour {
  if (!hourly || !hourly.temperature_2m) {
    return {
      temperature: null,
      cloudcover: 0,
      precipitation: 0,
      visibility: 10000,
      humidity: 0,
      windspeed: 0,
      winddirection: 0,
      condition: 'clear',
      conditionLabel: 'No data available',
      hasData: false,
    };
  }

  const code = hourly.weathercode?.[hourIndex] ?? 0;
  const decoded = decodeWeatherCode(code);
  const visibility = hourly.visibility?.[hourIndex] ?? 10000;
  const temp = hourly.temperature_2m?.[hourIndex];

  let category = decoded.category;
  let label = decoded.label;
  if (
    (category === 'clear' || category === 'mostly-clear' || category === 'partly-cloudy') &&
    visibility < 5000
  ) {
    category = 'haze';
    label = 'Haze';
  }

  return {
    temperature: temp ?? null,
    cloudcover: hourly.cloudcover?.[hourIndex] ?? 0,
    precipitation: hourly.precipitation?.[hourIndex] ?? 0,
    visibility,
    humidity: hourly.relative_humidity_2m?.[hourIndex] ?? 0,
    windspeed: hourly.windspeed_10m?.[hourIndex] ?? 0,
    winddirection: hourly.winddirection_10m?.[hourIndex] ?? 0,
    condition: category,
    conditionLabel: label,
    hasData: temp !== null && temp !== undefined,
  };
}

export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    hourly: null,
    dataAvailable: false,
    loading: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, WeatherHourlyRaw>>(new Map());

  const fetchWeather = useCallback(async (lat: number, lng: number, date: string) => {
    const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}_${date}`;

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setState({ hourly: cached, dataAvailable: true, loading: false, error: null });
      return;
    }

    // Cancel any request still in flight — this is the actual fix for
    // the race condition that caused stuck/flickering visuals.
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const url = `/api/weather?lat=${lat}&lng=${lng}&date=${date}`;
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();

      if (controller.signal.aborted) return;

      if (data.hourly) {
        cacheRef.current.set(cacheKey, data.hourly);
      }

      setState({
        hourly: data.hourly,
        dataAvailable: Boolean(data.dataAvailable),
        loading: false,
        error: data.error || null,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // expected during rapid changes
      setState({
        hourly: null,
        dataAvailable: false,
        loading: false,
        error: 'Could not load weather data',
      });
    }
  }, []);

  return { ...state, fetchWeather };
}
