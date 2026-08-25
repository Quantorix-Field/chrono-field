/* ============================================
   WEATHER & GEOCODING
   Live data via Open-Meteo (no API key required)
   ============================================ */

const Weather = (() => {

  const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  const REVERSE_URL = 'https://geocoding-api.open-meteo.com/v1/reverse';
  const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

  async function searchLocation(query) {
    if (!query || query.trim().length < 2) return [];

    const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;

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
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lng,
      hourly: 'temperature_2m,cloudcover,precipitation,weathercode,visibility,relative_humidity_2m,windspeed_10m',
      timezone: 'auto',
      start_date: dateStr,
      end_date: dateStr
    });

    const url = `${FORECAST_URL}?${params.toString()}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      return data.hourly || null;
    } catch (err) {
      console.error('Weather fetch failed:', err);
      return null;
    }
  }

  // WMO weather codes mapped to precise render categories + human labels
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
    if (!hourlyData) {
      return {
        temperature: null,
        cloudcover: 0,
        precipitation: 0,
        visibility: 10000,
        humidity: 0,
        windspeed: 0,
        condition: 'clear',
        conditionLabel: 'Clear sky'
      };
    }

    const code = hourlyData.weathercode?.[hourIndex] ?? 0;
    const decoded = decodeWeatherCode(code);
    const visibility = hourlyData.visibility?.[hourIndex] ?? 10000;

    // Haze isn't a distinct WMO code — infer it from reduced visibility
    // under otherwise clear/partly-cloudy conditions, same way real
    // weather apps distinguish "clear" from "hazy."
    let category = decoded.category;
    let label = decoded.label;
    if ((category === 'clear' || category === 'mostly-clear' || category === 'partly-cloudy') && visibility < 5000) {
      category = 'haze';
      label = 'Haze';
    }

    return {
      temperature: hourlyData.temperature_2m?.[hourIndex] ?? null,
      cloudcover: hourlyData.cloudcover?.[hourIndex] ?? 0,
      precipitation: hourlyData.precipitation?.[hourIndex] ?? 0,
      visibility,
      humidity: hourlyData.relative_humidity_2m?.[hourIndex] ?? 0,
      windspeed: hourlyData.windspeed_10m?.[hourIndex] ?? 0,
      condition: category,
      conditionLabel: label
    };
  }

  return {
    searchLocation,
    reverseGeocode,
    getWeather,
    getHourSlice,
    decodeWeatherCode
  };

})();
