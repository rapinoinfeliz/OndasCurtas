import re

with open('app.js', 'r') as f:
    content = f.read()

missing_code = """
// ---------------------------------------------------------------------------
// Filtros persistidos e Catálogo
// ---------------------------------------------------------------------------
function buildCatalogFromTx(transmissoes) {
  const bandas = new Set(), idiomas = new Set(), paises = new Set(), areas = new Set();
  transmissoes.forEach(tx => {
    if (tx.banda_metros) bandas.add(tx.banda_metros);
    if (tx.idioma)       idiomas.add(tx.idioma);
    if (tx.pais_origem)  paises.add(tx.pais_origem);
    if (tx.area_alvo)    areas.add(tx.area_alvo);
  });
  return {
    bandas: BANDA_ORDER.filter(b => bandas.has(b)),
    idiomas: Array.from(idiomas).sort((a, b) => a.localeCompare(b, 'en')),
    paises: Array.from(paises).sort((a, b) => a.localeCompare(b, 'en')),
    areas: Array.from(areas).sort((a, b) => a.localeCompare(b, 'en'))
  };
}

function persistFilters() {
  writeStorageJson(FILTERS_STORAGE_KEY, {
    search: state.filters.search,
    bandas: Array.from(state.filters.bandas),
    idiomas: Array.from(state.filters.idiomas),
    paises: Array.from(state.filters.paises),
    areas: Array.from(state.filters.areas),
    onlyOnAir: state.filters.onlyOnAir,
    onlyFavorites: state.filters.onlyFavorites
  });
}

function loadPersistedFilters() {
  const p = readStorageJson(FILTERS_STORAGE_KEY);
  if (!p || typeof p !== 'object') return;
  state.filters.search = String(p.search || '').trim();
  state.filters.bandas = new Set((Array.isArray(p.bandas) ? p.bandas : []).filter(v => state.catalogs.bandas.includes(v)));
  state.filters.idiomas = new Set((Array.isArray(p.idiomas) ? p.idiomas : []).filter(v => state.catalogs.idiomas.includes(v)));
  state.filters.paises = new Set((Array.isArray(p.paises) ? p.paises : []).filter(v => state.catalogs.paises.includes(v)));
  state.filters.areas = new Set((Array.isArray(p.areas) ? p.areas : []).filter(v => state.catalogs.areas.includes(v)));
  state.filters.onlyOnAir = !!p.onlyOnAir;
  state.filters.onlyFavorites = !!p.onlyFavorites;
  if (elements.searchInput) elements.searchInput.value = state.filters.search;
}

// ---------------------------------------------------------------------------
// UI Syncs (Dropdowns, Buttons)
// ---------------------------------------------------------------------------
function createMultiOption(value, label, type) {
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'multi-option-btn';
  btn.dataset.type = type; btn.dataset.value = value;
  btn.setAttribute('aria-pressed', 'false');
  const mark = document.createElement('span'); mark.className = 'multi-option-mark'; mark.textContent = '✓';
  const text = document.createElement('span'); text.className = 'multi-option-label'; text.textContent = label;
  btn.append(mark, text);
  return btn;
}

function renderMultiDropdownOptions(container, values, labelFn, type) {
  if (!container) return;
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  values.forEach(v => frag.appendChild(createMultiOption(v, labelFn(v), type)));
  container.appendChild(frag);
}

function syncMultiDropdownSelection(container, selectedSet) {
  if (!container) return;
  container.querySelectorAll('.multi-option-btn').forEach(btn => {
    const active = selectedSet.has(btn.dataset.value || '');
    btn.classList.toggle('multi-option-btn--active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function updateDropdownSummaries() {
  const selPaises = Array.from(state.filters.paises).sort();
  const selIdiomas = Array.from(state.filters.idiomas).sort();
  const selAreas = Array.from(state.filters.areas).sort();

  if (elements.paisDropdownSummary) {
    elements.paisDropdownSummary.textContent = selPaises.length === 0 ? 'País de origem' : selPaises.length <= 2 ? selPaises.join(', ') : `${selPaises.length} países`;
  }
  if (elements.idiomaDropdownSummary) {
    elements.idiomaDropdownSummary.textContent = selIdiomas.length === 0 ? 'Idioma' : selIdiomas.length === 1 ? selIdiomas[0] : `Idioma · ${selIdiomas.length}`;
  }
  if (elements.areaDropdownSummary) {
    elements.areaDropdownSummary.textContent = selAreas.length === 0 ? 'Área alvo' : selAreas.length === 1 ? selAreas[0] : `Área · ${selAreas.length}`;
  }
}

function updateDropdownClearButtons() {
  elements.dropdownClearButtons.forEach(btn => {
    const type = btn.dataset.dropdown || '';
    let show = false;
    if (type === 'pais') show = state.filters.paises.size > 0;
    if (type === 'idioma') show = state.filters.idiomas.size > 0;
    if (type === 'area') show = state.filters.areas.size > 0;
    btn.hidden = !show;
  });
}

function closeAllDropdowns(except) {
  [elements.paisDropdown, elements.idiomaDropdown, elements.areaDropdown].forEach(d => {
    if (d && d !== except) d.open = false;
  });
}

function syncBandButtons() {
  if (!elements.bandButtons) return;
  let activeCount = 0;
  elements.bandButtons.querySelectorAll('.band-filter-btn').forEach(btn => {
    const active = state.filters.bandas.has(btn.dataset.banda || '');
    if (active) activeCount++;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  elements.bandButtons.classList.toggle('has-active', activeCount > 0);
}

function hasActiveFilters() {
  return Boolean(
    state.filters.search.trim() || state.filters.bandas.size > 0 || state.filters.idiomas.size > 0 ||
    state.filters.paises.size > 0 || state.filters.areas.size > 0 || state.filters.onlyFavorites || state.filters.onlyOnAir
  );
}

function syncClearFiltersButton() {
  if (elements.clearFiltersBtn) elements.clearFiltersBtn.hidden = !hasActiveFilters();
}

function clearAllFilters() {
  state.filters.search = '';
  state.filters.bandas.clear(); state.filters.idiomas.clear(); state.filters.paises.clear(); state.filters.areas.clear();
  state.filters.onlyFavorites = false; state.filters.onlyOnAir = false;
  if (elements.searchInput) elements.searchInput.value = '';
}

function updateOnAirCount() {
  const count = state.transmissoes.filter(isOnAirNow).length;
  if (count === state.lastOnAirCount) return;
  state.lastOnAirCount = count;
  if (elements.headerTxCount) elements.headerTxCount.textContent = String(count);
  if (elements.headerCountLabel) elements.headerCountLabel.textContent = 'no ar';
}

function syncOnAirToggleButton() {
  if (!elements.onAirToggleBtn) return;
  const active = !!state.filters.onlyOnAir;
  elements.onAirToggleBtn.classList.toggle('on-air-toggle-btn--active', active);
  elements.onAirToggleBtn.setAttribute('aria-pressed', String(active));
}

// ---------------------------------------------------------------------------
// Ticker
// ---------------------------------------------------------------------------
function createTickerItemNode(tx, decorative = false) {
  const onAir = isOnAirNow(tx);
  const item = document.createElement(decorative ? 'span' : 'span');
  item.className = 'ticker-item';
  if (decorative) item.setAttribute('aria-hidden', 'true');
  if (onAir) {
    const dot = document.createElement('span'); dot.className = 'ticker-on-air-dot'; item.appendChild(dot);
  }
  const freq = document.createElement('span'); freq.className = 'ticker-freq'; freq.textContent = `${tx.freq_khz} kHz`;
  const banda = document.createElement('span'); banda.className = 'ticker-banda'; banda.textContent = tx.banda_metros;
  const sep1 = document.createElement('span'); sep1.className = 'ticker-sep'; sep1.textContent = '·';
  const name = document.createElement('span'); name.className = 'ticker-item-name'; name.textContent = tx.estacao || '—';
  const sep2 = document.createElement('span'); sep2.className = 'ticker-sep'; sep2.textContent = '·';
  const area = document.createElement('span'); area.className = 'ticker-item-area'; area.textContent = tx.area_alvo || tx.idioma || '';
  item.append(freq, ' ', banda, sep1, name, sep2, area);
  return item;
}

function renderHeaderTicker(filteredTx) {
  if (!elements.tickerTrack) return;
  elements.tickerTrack.innerHTML = '';
  elements.tickerTrack.classList.remove('ticker-track--static');
  const onAirNow = filteredTx.filter(isOnAirNow);
  const upcoming = filteredTx.filter(tx => !isOnAirNow(tx));
  const tickerItems = [...onAirNow, ...upcoming].slice(0, 14);
  if (elements.tickerLabelText) elements.tickerLabelText.textContent = onAirNow.length > 0 ? 'No ar agora' : 'Próximas';
  if (!tickerItems.length) {
    const empty = document.createElement('span'); empty.className = 'ticker-item'; empty.textContent = 'Nenhuma transmissão com os filtros atuais.';
    elements.tickerTrack.appendChild(empty); elements.tickerTrack.classList.add('ticker-track--static');
    return;
  }
  const baseSet = document.createDocumentFragment(); tickerItems.forEach(tx => baseSet.appendChild(createTickerItemNode(tx, false)));
  elements.tickerTrack.appendChild(baseSet);
  const dupeSet = document.createDocumentFragment(); tickerItems.forEach(tx => dupeSet.appendChild(createTickerItemNode(tx, true)));
  elements.tickerTrack.appendChild(dupeSet);
}

"""

# find insertion point before syncBackToTopButton
insert_idx = content.find("function syncBackToTopButton()")
if insert_idx != -1:
    new_content = content[:insert_idx] + missing_code + content[insert_idx:]
    with open('app.js', 'w') as f:
        f.write(new_content)
    print("Fixed app.js")
else:
    print("Could not find insertion point")
