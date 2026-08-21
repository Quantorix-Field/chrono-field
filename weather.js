/* ============================================
   WEATHER & GEOCODING
   Live data via Open-Meteo (no API key required)
   ============================================ */

const Weather = (() => {

  const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

  async function searchLocation(query) {
    if (!query || query.trim().length < 2) return [];

    const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data.results) return [];

      return data.results.map(place => ({
        name: place.name,
        country: place.country,
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

  async function getWeather(lat, lng, dateStr) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lng,
      hourly: 'temperature_2m,cloudcover,precipitation,weathercode,visibility',
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

  function weatherCodeToCondition(code) {
    // WMO weather codes, simplified into render-friendly categories
    if (code === 0) return 'clear';
    if (code <= 2) return 'partly-cloudy';
    if (code === 3) return 'overcast';
    if (code >= 45 && code <= 48) return 'fog';
    if (code >= 51 && code <= 67) return 'rain';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rain';
    if (code >= 85 && code <= 86) return 'snow';
    if (code >= 95) return 'storm';
    return 'clear';
  }

  function getHourSlice(hourlyData, hourIndex) {
    if (!hourlyData) return null;

    return {
      temperature: hourlyData.temperature_2m?.[hourIndex] ?? null,
      cloudcover: hourlyData.cloudcover?.[hourIndex] ?? 0,
      precipitation: hourlyData.precipitation?.[hourIndex] ?? 0,
      visibility: hourlyData.visibility?.[hourIndex] ?? 10000,
      condition: weatherCodeToCondition(hourlyData.weathercode?.[hourIndex] ?? 0)
    };
  }

  return {
    searchLocation,
    getWeather,
    getHourSlice,
    weatherCodeToCondition
  };

})();
