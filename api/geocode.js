/* ============================================
   SERVERLESS GEOCODING PROXY
   Handles both forward search (place name → coords)
   and reverse lookup (coords → place name), with
   retry logic and edge caching.
   ============================================ */

const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_URL = 'https://geocoding-api.open-meteo.com/v1/reverse';

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
    await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }
  throw lastError;
}

async function handleSearch(req, res) {
  const { query } = req.query;

  if (!query || query.trim().length < 2) {
    res.status(200).json({ results: [] });
    return;
  }

  const url = `${SEARCH_URL}?name=${encodeURIComponent(query)}&count=10&language=en&format=json`;

  try {
    const upstream = await fetchWithRetry(url, 2);
    const data = await upstream.json();

    const results = (data.results || []).map((place) => ({
      name: place.name,
      country: place.country || '',
      admin1: place.admin1 || '',
      lat: place.latitude,
      lng: place.longitude,
      timezone: place.timezone,
    }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ results });
  } catch (err) {
    console.error('Geocode search failed:', err.message);
    res.status(502).json({ results: [], error: 'Location search temporarily unavailable' });
  }
}

async function handleReverse(req, res) {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    res.status(400).json({ error: 'Missing required parameters: lat, lng' });
    return;
  }

  const url = `${REVERSE_URL}?latitude=${lat}&longitude=${lng}&language=en&format=json`;

  try {
    const upstream = await fetchWithRetry(url, 2);
    const data = await upstream.json();

    if (!data.results || !data.results.length) {
      res.status(200).json({ result: null });
      return;
    }

    const place = data.results[0];
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      result: {
        name: place.name,
        country: place.country || '',
        admin1: place.admin1 || '',
      },
    });
  } catch (err) {
    console.error('Reverse geocode failed:', err.message);
    res.status(502).json({ result: null, error: 'Reverse geocoding temporarily unavailable' });
  }
}

export default async function handler(req, res) {
  const { mode } = req.query;

  if (mode === 'reverse') {
    await handleReverse(req, res);
  } else {
    await handleSearch(req, res);
  }
}
