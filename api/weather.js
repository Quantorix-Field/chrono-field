/* ============================================
   SERVERLESS WEATHER PROXY
   Runs on Vercel's edge as a Node.js function.
   Chooses forecast vs. historical archive data,
   retries on transient failure, and caches
   responses briefly to reduce redundant calls.
   ============================================ */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const ARCHIVE_LAG_DAYS = 5;

const HOURLY_FIELDS = [
  'temperature_2m',
  'cloudcover',
  'precipitation',
  'weathercode',
  'visibility',
  'relative_humidity_2m',
  'windspeed_10m',
  'winddirection_10m',
].join(',');

function isArchiveDate(dateStr) {
  const requested = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - ARCHIVE_LAG_DAYS);
  return requested < cutoff;
}

async function fetchWithRetry(url, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      lastError = new Error(`Upstream returned ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    // Small backoff before retrying
    await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }
  throw lastError;
}

export default async function handler(req, res) {
  const { lat, lng, date } = req.query;

  if (!lat || !lng || !date) {
    res.status(400).json({ error: 'Missing required parameters: lat, lng, date' });
    return;
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    res.status(400).json({ error: 'lat and lng must be valid numbers' });
    return;
  }

  const useArchive = isArchiveDate(date);
  const baseUrl = useArchive ? ARCHIVE_URL : FORECAST_URL;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: HOURLY_FIELDS,
    timezone: 'auto',
    start_date: date,
    end_date: date,
  });

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const upstream = await fetchWithRetry(url, 2);
    const data = await upstream.json();

    const hourly = data.hourly || null;
    const hasRealData =
      hourly &&
      Array.isArray(hourly.temperature_2m) &&
      hourly.temperature_2m.some((v) => v !== null && v !== undefined);

    // Cache at the edge for 10 minutes — weather doesn't change fast enough
    // to need fresher data than that, and this cuts redundant upstream calls.
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');

    res.status(200).json({
      hourly,
      dataAvailable: Boolean(hasRealData),
      source: useArchive ? 'archive' : 'forecast',
    });
  } catch (err) {
    console.error('Weather proxy failed:', err.message);
    res.status(502).json({
      error: 'Weather data temporarily unavailable',
      hourly: null,
      dataAvailable: false,
    });
  }
}
