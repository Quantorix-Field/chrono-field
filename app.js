/* ============================================
   APP
   Wires astronomy + weather + renderer + UI
   together into one live, reactive experience.
   ============================================ */

(function () {

  let currentWeatherHourly = null;
  let currentWeatherKey = null;

  function init() {
    const canvas = document.getElementById('sky-canvas');
    SkyRenderer.init(canvas);
    Watermark.init();
    UI.init(handleStateChange);
  }

  async function handleStateChange({ location, date, minutes }) {
    const dateObj = new Date(`${date}T00:00:00`);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    const momentDate = new Date(dateObj);
    momentDate.setHours(hours, mins, 0, 0);

    // --- Astronomy (instant, pure math, no network needed) ---
    const sunPos = Astronomy.getSunPosition(momentDate, location.lat, location.lng);
    const sunTimes = Astronomy.getSunTimes(momentDate, location.lat, location.lng);
    const moonPhase = Astronomy.getMoonPhase(momentDate);

    // Approximate moon azimuth as offset from sun azimuth using phase angle,
    // since full moon-position ephemeris is beyond what's needed for rendering.
    const moonAzimuth = sunPos.azimuth + Math.PI;
    const moonAltitude = -sunPos.altitude * 0.6;

    // --- Weather (network, cached per location+date to avoid refetching every slider tick) ---
    const weatherKey = `${location.lat.toFixed(2)},${location.lng.toFixed(2)}_${date}`;
    if (weatherKey !== currentWeatherKey) {
      currentWeatherKey = weatherKey;
      currentWeatherHourly = await Weather.getWeather(location.lat, location.lng, date);
    }

    const weatherHour = Weather.getHourSlice(currentWeatherHourly, hours);

    // --- Push everything into the renderer, including the fields it needs
    //     to precisely render fog/haze/storm intensity ---
    SkyRenderer.update({
      sunAltitude: sunPos.altitude,
      sunAzimuth: sunPos.azimuth,
      moonAltitude: moonAltitude,
      moonAzimuth: moonAzimuth,
      moonPhase: moonPhase.phase,
      condition: weatherHour.condition,
      cloudcover: weatherHour.cloudcover,
      precipitation: weatherHour.precipitation,
      visibility: weatherHour.visibility,
      windspeed: weatherHour.windspeed
    });

    // --- Update the info panel text ---
    UI.renderInfo({ sunTimes, moonPhase, weatherHour });
  }

  document.addEventListener('DOMContentLoaded', init);

})();
