const map = L.map('map', {
  zoomControl: true,
  fadeAnimation: true,
  zoomAnimation: true,
  zoomAnimationThreshold: 4
}).setView([20, 0], 2);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
});

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri'
}).addTo(map);

// Cloud overlay layer from OpenWeatherMap
const cloudLayer = L.tileLayer('https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=42e8511f67089e9b43d93ad0ced6dc15', {
  opacity: 0.4,
  attribution: 'Weather data © OpenWeatherMap'
}).addTo(map);

const baseMaps = {
  "Street View": osm,
  "Satellite View": satellite
};
L.control.layers(baseMaps).addTo(map);

const input = document.getElementById('searchInput');
const suggestionsBox = document.getElementById('suggestions');
const recentSearchesBox = document.getElementById('recentSearches');
const clearBtn = document.getElementById('clearBtn');
let marker, boundaryLayer;
const recent = [];

async function searchLocation(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&polygon_geojson=1&addressdetails=1&extratags=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MapApp/1.0 (user@example.com)' }
  });
  const data = await res.json();
  return data.filter(item => item.class === 'boundary' && item.type === 'administrative');
}

function updateRecent(name, lat, lon) {
  if (!recent.find(r => r.name === name)) {
    recent.unshift({ name, lat, lon });
    if (recent.length > 5) recent.pop();
    renderRecent();
  }
}

function renderRecent() {
  recentSearchesBox.innerHTML = `<strong>Recent:</strong> `;
  recent.forEach(r => {
    const span = document.createElement('span');
    span.className = 'recent-item';
    span.innerText = r.name;
    span.onclick = () => moveToLocation(r.name, r.lat, r.lon);
    recentSearchesBox.appendChild(span);
  });
}

async function updateDetails(result) {
  const lat = result.lat;
  const lon = result.lon;
  const place = result.display_name.split(',')[0];
  const bbox = result.boundingbox;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`);
    const data = await res.json();
    const address = data.address || {};
    const district = address.state_district || address.county || '';
    const state = address.state || '';
    const country = address.country || '';
    const details = document.getElementById('detailsBox');
    details.innerHTML = `
      <h3>Details</h3>
      <p><strong>Place:</strong> ${place}</p>
      <p><strong>Coordinates:</strong> ${lat}, ${lon}</p>
      <p><strong>Bounding Box:</strong> [${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}]</p>
      <p><strong>District:</strong> ${district}</p>
      <p><strong>State:</strong> ${state}</p>
      <p><strong>Country:</strong> ${country}</p>
    `;
    details.classList.add('visible');
    document.getElementById('weatherBox').classList.add('moved');
  } catch (err) {
    console.error('Reverse geocoding failed:', err);
  }
}

async function fetchWeather(lat, lon) {
  const apiKey = '42e8511f67089e9b43d93ad0ced6dc15';
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
    const data = await res.json();
    document.querySelector('#weatherBox .location').innerText = data.name || 'Unknown';
    document.querySelector('#weatherBox .temp').innerText = `Temperature: ${data.main.temp} °C`;
    document.querySelector('#weatherBox .humidity').innerText = `Humidity: ${data.main.humidity}%`;
    document.querySelector('#weatherBox .min').innerText = `Min Temp: ${data.main.temp_min} °C`;
    document.querySelector('#weatherBox .max').innerText = `Max Temp: ${data.main.temp_max} °C`;
    document.querySelector('#weatherBox .wind').innerText = `Wind Speed: ${data.wind.speed} m/s`;
  } catch (err) {
    console.error('Weather fetch failed:', err);
  }
}

async function handleSearch(query) {
  const results = await searchLocation(query);
  if (results.length === 0) {
    alert('No administrative boundaries found.');
    return;
  }
  const result = results[0];
  const { lat, lon, display_name, geojson } = result;
  moveToLocation(display_name, lat, lon, geojson);
  updateRecent(display_name, lat, lon);
  updateDetails(result);
  fetchWeather(lat, lon);
}

function moveToLocation(name, lat, lon, geojson) {
  if (marker) map.removeLayer(marker);
  marker = L.marker([lat, lon]).addTo(map).bindPopup(name).openPopup();
  if (boundaryLayer) map.removeLayer(boundaryLayer);
  if (geojson) {
    boundaryLayer = L.geoJSON(geojson, {
      style: { color: 'red', weight: 2, fill: false }
    }).addTo(map);
    const bounds = boundaryLayer.getBounds();
    const paddingY = window.innerHeight * 0.1;
    const topLeft = map.latLngToContainerPoint(bounds.getNorthWest());
    const bottomRight = map.latLngToContainerPoint(bounds.getSouthEast());
    const height = Math.abs(bottomRight.y - topLeft.y);
    if (height > window.innerHeight - paddingY * 2) {
      map.fitBounds(bounds, { animate: true, paddingTopLeft: [0, paddingY], paddingBottomRight: [0, paddingY] });
    } else {
      map.flyToBounds(bounds, { animate: true });
    }
  } else {
    map.flyTo([lat, lon], 10, { animate: true, duration: 1.5 });
  }
  clearBtn.style.display = 'block';
}

input.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    suggestionsBox.innerHTML = '';
    handleSearch(input.value.trim());
  }
});

input.addEventListener('input', async () => {
  const query = input.value.trim();
  if (query.length < 2) {
    suggestionsBox.innerHTML = '';
    return;
  }
  const results = await searchLocation(query);
  suggestionsBox.innerHTML = '';
  results.forEach(res => {
    const div = document.createElement('div');
    div.className = 'suggestion';
    div.innerText = res.display_name;
    div.onclick = () => {
      input.value = res.display_name;
      suggestionsBox.innerHTML = '';
      handleSearch(res.display_name);
    };
    suggestionsBox.appendChild(div);
  });
});

clearBtn.addEventListener('click', () => {
  input.value = '';
  suggestionsBox.innerHTML = '';
  clearBtn.style.display = 'none';
  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }
  if (boundaryLayer) {
    map.removeLayer(boundaryLayer);
    boundaryLayer = null;
  }
  map.flyTo([20, 0], 2, { animate: true, duration: 1.5 });
  const details = document.getElementById('detailsBox');
  details.innerHTML = '';
  details.classList.remove('visible');
  document.getElementById('weatherBox').classList.remove('moved');
  document.querySelector('#weatherBox .location').innerText = 'Location';
  document.querySelector('#weatherBox .temp').innerText = 'Temperature: -- °C';
  document.querySelector('#weatherBox .humidity').innerText = 'Humidity: --%';
  document.querySelector('#weatherBox .min').innerText = 'Min Temp: -- °C';
  document.querySelector('#weatherBox .max').innerText = 'Max Temp: -- °C';
  document.querySelector('#weatherBox .wind').innerText = 'Wind Speed: -- m/s';
});