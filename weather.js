/* ============================================
   WEATHER & GEOCODING
   Live data via Open-Meteo (no API key required).
   Automatically chooses forecast vs. historical
   archive data based on the requested date, and
   exposes the real valid date range so the UI
   can't request dates with no real data.
   ============================================ */

const Weather = (() => {

  const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  const REVERSE_URL = 'https://geocoding-api.open-meteo.com/v1/reverse';
  const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

  const FORECAST_DAYS_AHEAD = 16;
  const ARCHIVE_LAG_DAYS = 5; // archive data typically lags ~5 days behind real-time

  function formatDate(d) {
    return d.toISOString().split('T')[0];
  }

  // The real window of dates we can get genuine weather data for.
  function getValidDateRange() {
    const today = new Date();

    const minDate = new Date('1940-01-01');

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + FORECAST_DAYS_AHEAD);

    return {
      min: formatDate(minDate),
      max: formatDate(maxDate)
    };
  }

  function isArchiveDate(dateStr) {
    const requested = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - ARCHIVE_LAG_DAYS);
    return requested < cutoff;
  }

  async function searchLocation(query) {
    if (!query || query.trim().length < 2) return [];

    const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=10&language=en&format=json`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data.results) return [];

      return data.results.map(place => ({
        name: place.name,
        country: place.country || '',
        admin1: place.admin1 || '',
        lat: place.latitude,
        lng: place.longitude,
        timezone: place.timezone
      }));
    } catch (err) {
      console.error('Location search failed:', err);
      return [];
    }
  }

  async function reverseGeocode(lat, lng) {
    const url = `${REVERSE_URL}?latitude=${lat}&longitude=${lng}&language=en&format=json`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data.results || !data.results.length) return null;

      const place = data.results[0];
      return {
        name: place.name,
        country: place.country || '',
        admin1: place.admin1 || ''
      };
    } catch (err) {
      console.error('Reverse geocode failed:', err);
      return null;
    }
  }

  async function getWeather(lat, lng, dateStr) {
    const useArchive = isArchiveDate(dateStr);
    const baseUrl = useArchive ? ARCHIVE_URL : FORECAST_URL;

    const params = new URLSearchParams({
      latitude: lat,
      longitude: lng,
      hourly: 'temperature_2m,cloudcover,precipitation,weathercode,visibility,relative_humidity_2m,windspeed_10m',
      timezone: 'auto',
      start_date: dateStr,
      end_date: dateStr
    });

    const url = `${baseUrl}?${params.toString()}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Weather request failed (${res.status}) for ${dateStr}`);
        return { hourly: null, dataAvailable: false, source: useArchive ? 'archive' : 'forecast' };
      }
      const data = await res.json();

      const hourly = data.hourly || null;
      const hasRealData = hourly && Array.isArray(hourly.temperature_2m) &&
        hourly.temperature_2m.some(v => v !== null && v !== undefined);

      return { hourly, dataAvailable: hasRealData, source: useArchive ? 'archive' : 'forecast' };
    } catch (err) {
      console.error('Weather fetch failed:', err);
      return { hourly: null, dataAvailable: false, source: useArchive ? 'archive' : 'forecast' };
    }
  }

  const WMO_MAP = {
    0:  { category: 'clear',        label: 'Clear sky' },
    1:  { category: 'mostly-clear', label: 'Mostly clear' },
    2:  { category: 'partly-cloudy',label: 'Partly cloudy' },
    3:  { category: 'overcast',     label: 'Overcast' },
    45: { category: 'fog',          label: 'Fog' },
    48: { category: 'fog',          label: 'Depositing rime fog' },
    51: { category: 'drizzle',      label: 'Light drizzle' },
    53: { category: 'drizzle',      label: 'Drizzle' },
    55: { category: 'drizzle',      label: 'Dense drizzle' },
    56: { category: 'drizzle',      label: 'Freezing drizzle' },
    57: { category: 'drizzle',      label: 'Freezing drizzle' },
    61: { category: 'rain',         label: 'Light rain' },
    63: { category: 'rain',         label: 'Rain' },
    65: { category: 'rain',         label: 'Heavy rain' },
    66: { category: 'rain',         label: 'Freezing rain' },
    67: { category: 'rain',         label: 'Freezing rain' },
    71: { category: 'snow',         label: 'Light snow' },
    73: { category: 'snow',         label: 'Snow' },
    75: { category: 'snow',         label: 'Heavy snow' },
    77: { category: 'snow',         label: 'Snow grains' },
    80: { category: 'rain',         label: 'Rain showers' },
    81: { category: 'rain',         label: 'Rain showers' },
    82: { category: 'rain',         label: 'Violent rain showers' },
    85: { category: 'snow',         label: 'Snow showers' },
    86: { category: 'snow',         label: 'Heavy snow showers' },
    95: { category: 'storm',        label: 'Thunderstorm' },
    96: { category: 'storm',        label: 'Thunderstorm with hail' },
    99: { category: 'storm',        label: 'Thunderstorm with heavy hail' }
  };

  function decodeWeatherCode(code) {
    return WMO_MAP[code] || { category: 'clear', label: 'Clear sky' };
  }

  function getHourSlice(hourlyData, hourIndex) {
    if (!hourlyData || !hourlyData.temperature_2m) {
      return {
        temperature: null,
        cloudcover: 0,
        precipitation: 0,
        visibility: 10000,
        humidity: 0,
        windspeed: 0,
        condition: 'clear',
        conditionLabel: 'No data available',
        hasData: false
      };
    }

    const code = hourlyData.weathercode?.[hourIndex] ?? 0;
    const decoded = decodeWeatherCode(code);
    const visibility = hourlyData.visibility?.[hourIndex] ?? 10000;
    const temp = hourlyData.temperature_2m?.[hourIndex];

    let category = decoded.category;
    let label = decoded.label;
    if ((category === 'clear' || category === 'mostly-clear' || category === 'partly-cloudy') && visibility < 5000) {
      category = 'haze';
      label = 'Haze';
    }

    return {
      temperature: temp !== undefined ? temp : null,
      cloudcover: hourlyData.cloudcover?.[hourIndex] ?? 0,
      precipitation: hourlyData.precipitation?.[hourIndex] ?? 0,
      visibility,
      humidity: hourlyData.relative_humidity_2m?.[hourIndex] ?? 0,
      windspeed: hourlyData.windspeed_10m?.[hourIndex] ?? 0,
      condition: category,
      conditionLabel: label,
      hasData: temp !== null && temp !== undefined
    };
  }

  return {
    searchLocation,
    reverseGeocode,
    getWeather,
    getHourSlice,
    decodeWeatherCode,
    getValidDateRange
  };

})();
