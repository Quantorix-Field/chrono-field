/* ============================================
   useGeolocation HOOK
   Detects the user's real position and resolves
   it to a place name via our geocode proxy.
   Forces a fresh reading (no stale cache) and
   reports clear status instead of failing silently.
   ============================================ */

import { useState, useCallback } from 'react';
import type { Location } from '@/types';

type GeoStatus = 'idle' | 'locating' | 'success' | 'denied' | 'error';

interface GeolocationState {
  location: Location | null;
  status: GeoStatus;
  message: string;
}

const FALLBACK_LOCATION: Location = {
  name: 'Tokyo',
  admin1: '',
  country: 'Japan',
  lat: 35.6762,
  lng: 139.6503,
};

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    status: 'idle',
    message: '',
  });

  const detect = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        location: FALLBACK_LOCATION,
        status: 'error',
        message: 'Location unavailable on this device — showing Tokyo. Search your city above.',
      });
      return;
    }

    setState((prev) => ({ ...prev, status: 'locating', message: 'Detecting your location…' }));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        try {
          const res = await fetch(`/api/geocode?mode=reverse&lat=${lat}&lng=${lng}`);
          const data = await res.json();
          const place = data.result;

          setState({
            location: {
              name: place?.name || `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
              admin1: place?.admin1 || '',
              country: place?.country || '',
              lat,
              lng,
            },
            status: 'success',
            message: '',
          });
        } catch {
          setState({
            location: { name: `${lat.toFixed(2)}, ${lng.toFixed(2)}`, admin1: '', country: '', lat, lng },
            status: 'success',
            message: '',
          });
        }
      },
      (err) => {
        const isDenied = err.code === err.PERMISSION_DENIED;
        setState({
          location: FALLBACK_LOCATION,
          status: isDenied ? 'denied' : 'error',
          message: isDenied
            ? 'Location access denied — showing Tokyo. Search your city above.'
            : "Couldn't determine your location — showing Tokyo. Search your city above.",
        });
      },
      {
        timeout: 10000,
        enableHighAccuracy: true,
        maximumAge: 0, // force a fresh reading, never a stale cached one
      }
    );
  }, []);

  return { ...state, detect };
}
