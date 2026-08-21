/* ============================================
   UI CONTROLLER
   Handles search, date/time input, and dispatches
   updates to the rest of the app.
   ============================================ */

const UI = (() => {

  let locationInput, dateInput, timeSlider, timeReadout;
  let sunInfo, moonInfo, weatherInfo;
  let suggestionBox;

  let selectedLocation = null;
  let searchDebounce = null;
  let onChangeCallback = null;

  function init(onChange) {
    onChangeCallback = onChange;

    locationInput = document.getElementById('location-input');
    dateInput = document.getElementById('date-input');
    timeSlider = document.getElementById('time-slider');
    timeReadout = document.getElementById('time-readout');
    sunInfo = document.getElementById('sun-info');
    moonInfo = document.getElementById('moon-info');
    weatherInfo = document.getElementById('weather-info');

    createSuggestionBox();
    setDefaultDate();
    updateTimeReadout();

    locationInput.addEventListener('input', handleLocationInput);
    dateInput.addEventListener('change', handleChange);
    timeSlider.addEventListener('input', () => {
      updateTimeReadout();
      handleChange();
    });

    // Try to detect user's own location on first load for an instant "wow"
    detectUserLocation();
  }

  function setDefaultDate() {
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];
  }

  function updateTimeReadout() {
    const minutes = parseInt(timeSlider.value, 10);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    timeReadout.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function createSuggestionBox() {
    suggestionBox = document.createElement('div');
    suggestionBox.id = 'suggestion-box';
    suggestionBox.style.cssText = `
      position: relative;
      background: rgba(10,12,20,0.95);
      border-radius: 10px;
      overflow: hidden;
      display: none;
    `;
    locationInput.parentNode.insertBefore(suggestionBox, locationInput.nextSibling);
  }

  function handleLocationInput() {
    const query = locationInput.value;
    clearTimeout(searchDebounce);

    if (query.trim().length < 2) {
      suggestionBox.style.display = 'none';
      return;
    }

    searchDebounce = setTimeout(async () => {
      const results = await Weather.searchLocation(query);
      renderSuggestions(results);
    }, 350);
  }

  function renderSuggestions(results) {
    suggestionBox.innerHTML = '';

    if (!results.length) {
      suggestionBox.style.display = 'none';
      return;
    }

    results.forEach(place => {
      const item = document.createElement('div');
      item.textContent = `${place.name}${place.admin1 ? ', ' + place.admin1 : ''}, ${place.country}`;
      item.style.cssText = `
        padding: 0.65rem 1rem;
        cursor: pointer;
        font-size: 0.9rem;
        color: #eef1f7;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      `;
      item.addEventListener('click', () => selectLocation(place));
      suggestionBox.appendChild(item);
    });

    suggestionBox.style.display = 'block';
  }

  function selectLocation(place) {
    selectedLocation = place;
    locationInput.value = `${place.name}, ${place.country}`;
    suggestionBox.style.display = 'none';
    handleChange();
  }

  async function detectUserLocation() {
    if (!navigator.geolocation) {
      useDefaultLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        selectedLocation = {
          name: 'Your location',
          country: '',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        locationInput.placeholder = 'Your current location';
        handleChange();
      },
      () => useDefaultLocation(),
      { timeout: 5000 }
    );
  }

  function useDefaultLocation() {
    selectedLocation = { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 };
    locationInput.value = 'Tokyo, Japan';
    handleChange();
  }

  function handleChange() {
    if (!selectedLocation) return;

    const date = dateInput.value;
    const minutes = parseInt(timeSlider.value, 10);

    if (onChangeCallback) {
      onChangeCallback({
        location: selectedLocation,
        date,
        minutes
      });
    }
  }

  function renderInfo({ sunTimes, moonPhase, weatherHour }) {
    if (sunTimes) {
      sunInfo.textContent = `Sunrise ${formatTime(sunTimes.sunrise)} · Sunset ${formatTime(sunTimes.sunset)}`;
    }
    if (moonPhase) {
      moonInfo.textContent = `${Astronomy.phaseName(moonPhase.phase)} · ${Math.round(moonPhase.fraction * 100)}% illuminated`;
    }
    if (weatherHour) {
      const temp = weatherHour.temperature !== null ? `${Math.round(weatherHour.temperature)}°C` : '—';
      weatherInfo.textContent = `${temp} · ${weatherHour.condition} · ${weatherHour.cloudcover}% cloud`;
    }
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return { init, renderInfo };

})();
