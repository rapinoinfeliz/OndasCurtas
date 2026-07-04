// ---------------------------------------------------------------------------
// Mapa de Transmissores
// ---------------------------------------------------------------------------
let countryCoords = null;

async function loadCountryCoords() {
  try {
    const res = await fetch('./data/country_coords.json');
    countryCoords = await res.json();
  } catch (err) {
    console.error('Failed to load country coords', err);
  }
}

function initMap() {
  if (!elements.mapContainer || typeof L === 'undefined') return;
  state.map = L.map('mapContainer', {
    center: [20, 0],
    zoom: 2,
    worldCopyJump: true
  });

  const isDark = state.ui.theme === 'dark';
  const tileUrl = isDark 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  L.tileLayer(tileUrl, {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  }).addTo(state.map);
}

function syncMapTheme() {
  if (!state.map) return;
  const isDark = state.ui.theme === 'dark';
  const tileUrl = isDark 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  
  state.map.eachLayer(layer => {
    if (layer instanceof L.TileLayer) {
      layer.setUrl(tileUrl);
    }
  });
}

function renderMapMarkers(filteredTx) {
  if (!state.map || !countryCoords) return;

  state.mapMarkers.forEach(m => m.remove());
  state.mapMarkers = [];

  const groups = new Map();
  filteredTx.forEach(tx => {
    const itu = tx.pais_itu;
    if (!itu) return;
    if (!groups.has(itu)) groups.set(itu, []);
    groups.get(itu).push(tx);
  });

  groups.forEach((txs, itu) => {
    const coords = countryCoords[itu];
    if (!coords) return;

    const count = txs.length;
    const marker = L.circleMarker(coords, {
      radius: Math.min(20, 5 + (count * 0.5)),
      fillColor: state.ui.theme === 'dark' ? '#38bdf8' : '#0284c7',
      color: state.ui.theme === 'dark' ? '#0f172a' : '#ffffff',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.7
    });

    const estacoes = Array.from(new Set(txs.map(t => t.estacao))).filter(Boolean);
    const popupHtml = `
      <div class="map-popup" style="font-family: var(--font-base); font-size: 0.9rem;">
        <strong style="font-weight: 700;">${txs[0].pais_origem || itu}</strong><br>
        ${count} ${count === 1 ? 'transmissão' : 'transmissões'}<br>
        <span style="font-size: 0.85em; opacity: 0.8;">
          ${estacoes.slice(0, 3).join(', ')}
          ${estacoes.length > 3 ? '...' : ''}
        </span>
      </div>
    `;
    marker.bindPopup(popupHtml);
    marker.addTo(state.map);
    state.mapMarkers.push(marker);
  });
}

