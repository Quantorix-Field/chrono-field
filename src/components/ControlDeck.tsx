/* ============================================
   CONTROLDECK
   Location search, date picker, and time slider.
   Search input updates instantly for the user;
   the actual geocode request is debounced so
   typing doesn't fire a request per keystroke.
   Search results are also cached in localStorage
   so re-searching a recent query is instant.
============================================ */
import { useState, useEffect, useRef } from 'react';
import type { Location, DateRange } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { getCached, setCached } from '@/utils/cache';

interface ControlDeckProps {
  location: Location | null;
  onLocationSelect: (location: Location) => void;
  date: string;
  onDateChange: (date: string) => void;
  dateRange: DateRange;
  minutes: number;
  onMinutesChange: (minutes: number) => void;
  onUseMyLocation: () => void;
  geoStatus: 'idle' | 'locating' | 'success' | 'denied' | 'error';
}

interface SearchResult {
  name: string;
  admin1: string;
  country: string;
  lat: number;
  lng: number;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${mins.toString().padStart(2, '0')} ${period}`;
}

export default function ControlDeck({
  location,
  onLocationSelect,
  date,
  onDateChange,
  dateRange,
  minutes,
  onMinutesChange,
  onUseMyLocation,
  geoStatus,
}: ControlDeckProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const debouncedQuery = useDebounce(query, 350);
  const requestIdRef = useRef(0);

  // Search fires only on the debounced value, checks the cache first,
  // and guards against out-of-order responses the same way useWeather
  // does — a fast second query can't have its result overwritten by a
  // slow first one.
  useEffect(() => {
    const trimmed = debouncedQuery.trim().toLowerCase();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    const cacheKey = `geocode:${trimmed}`;
    const cached = getCached<SearchResult[]>(cacheKey);
    if (cached) {
      setResults(cached);
      setSearching(false);
      return;
    }

    const thisRequestId = ++requestIdRef.current;
    setSearching(true);

    fetch(`/api/geocode?mode=search&query=${encodeURIComponent(trimmed)}`)
      .then((res) => res.json())
      .then((data) => {
        if (thisRequestId !== requestIdRef.current) return; // stale, ignore
        const found: SearchResult[] = data.results || [];
        setResults(found);
        setSearching(false);
        // Cache even empty results briefly — repeatedly re-querying a
        // known-bad search string wastes a network round trip.
        setCached(cacheKey, found, 1000 * 60 * 30); // 30 min TTL for search
      })
      .catch(() => {
        if (thisRequestId !== requestIdRef.current) return;
        setResults([]);
        setSearching(false);
      });
  }, [debouncedQuery]);

  function handleSelect(result: SearchResult) {
    onLocationSelect(result);
    setQuery('');
    setResults([]);
    setShowResults(false);
  }

  return (
    <div className="control-deck">
      <div className="control-deck__search">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder={location ? `${location.name}, ${location.country}` : 'Search a place…'}
          aria-label="Search for a location"
        />

        <button
          type="button"
          onClick={onUseMyLocation}
          disabled={geoStatus === 'locating'}
          aria-label="Use my current location"
          className="control-deck__locate-btn"
        >
          {geoStatus === 'locating' ? '…' : '📍'}
        </button>

        {showResults && (searching || results.length > 0) && (
          <ul className="control-deck__results">
            {searching && <li className="control-deck__results-status">Searching…</li>}
            {!searching &&
              results.map((r, i) => (
                <li key={`${r.lat}-${r.lng}-${i}`}>
                  <button type="button" onClick={() => handleSelect(r)}>
                    {r.name}
                    <span className="control-deck__result-sub">
                      {[r.admin1, r.country].filter(Boolean).join(', ')}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="control-deck__date">
        <input
          type="date"
          value={date}
          min={dateRange.min}
          max={dateRange.max}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label="Select date"
        />
      </div>

      <div className="control-deck__time">
        <label htmlFor="time-slider" className="control-deck__time-label">
          {formatMinutes(minutes)}
        </label>
        <input
          id="time-slider"
          type="range"
          min={0}
          max={1439}
          step={1}
          value={minutes}
          onChange={(e) => onMinutesChange(Number(e.target.value))}
          aria-label="Time of day"
        />
      </div>
    </div>
  );
}
