/* ============================================
   INFOPANEL
   Plain-language readout of sun/moon/weather —
   the accessible, textual counterpart to the
   WebGL canvas, which a screen reader can't
   interpret on its own.
============================================ */
import type { SunTimes, MoonData, WeatherHour, Location } from '@/types';

interface InfoPanelProps {
  location: Location | null;
  sunTimes: SunTimes | null;
  moon: MoonData | null;
  weather: WeatherHour;
  loading: boolean;
  error: string | null;
}

function formatTime(date: Date | null | undefined): string {
  if (!date) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function moonPhaseLabel(phase: number): string {
  // phase: 0 = new, 0.5 = full, 1 = new again
  if (phase < 0.03 || phase > 0.97) return 'New moon';
  if (phase < 0.22) return 'Waxing crescent';
  if (phase < 0.28) return 'First quarter';
  if (phase < 0.47) return 'Waxing gibbous';
  if (phase < 0.53) return 'Full moon';
  if (phase < 0.72) return 'Waning gibbous';
  if (phase < 0.78) return 'Last quarter';
  return 'Waning crescent';
}

export default function InfoPanel({ location, sunTimes, moon, weather, loading, error }: InfoPanelProps) {
  return (
    <section className="info-panel" aria-label="Sky and weather details">
      <header className="info-panel__location">
        <h1>{location ? `${location.name}${location.admin1 ? `, ${location.admin1}` : ''}` : 'Loading location…'}</h1>
        {location?.country && <p className="info-panel__country">{location.country}</p>}
      </header>

      {error && (
        <p className="info-panel__error" role="alert">
          {error}
        </p>
      )}

      {loading && !error && <p className="info-panel__loading">Fetching sky data…</p>}

      {!loading && !error && (
        <>
          <div className="info-panel__weather">
            <span className="info-panel__temp">
              {weather.hasData ? `${Math.round(weather.temperature ?? 0)}°` : '—'}
            </span>
            <span className="info-panel__condition">{weather.conditionLabel}</span>
          </div>

          <dl className="info-panel__stats">
            <div>
              <dt>Cloud cover</dt>
              <dd>{weather.hasData ? `${Math.round(weather.cloudcover)}%` : '—'}</dd>
            </div>
            <div>
              <dt>Wind</dt>
              <dd>{weather.hasData ? `${Math.round(weather.windspeed)} km/h` : '—'}</dd>
            </div>
            <div>
              <dt>Humidity</dt>
              <dd>{weather.hasData ? `${Math.round(weather.humidity)}%` : '—'}</dd>
            </div>
            <div>
              <dt>Visibility</dt>
              <dd>{weather.hasData ? `${(weather.visibility / 1000).toFixed(1)} km` : '—'}</dd>
            </div>
          </dl>

          {sunTimes && (
            <dl className="info-panel__sun">
              <div>
                <dt>Sunrise</dt>
                <dd>{formatTime(sunTimes.sunrise)}</dd>
              </div>
              <div>
                <dt>Sunset</dt>
                <dd>{formatTime(sunTimes.sunset)}</dd>
              </div>
              <div>
                <dt>Solar noon</dt>
                <dd>{formatTime(sunTimes.solarNoon)}</dd>
              </div>
            </dl>
          )}

          {moon && (
            <div className="info-panel__moon">
              <span>{moonPhaseLabel(moon.phase)}</span>
              <span className="info-panel__moon-illum">{Math.round(moon.fraction * 100)}% illuminated</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
