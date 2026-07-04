/* ==========================================================================
   OndasCurtas — app.js
   Calendário de rádio em ondas curtas (SW/HF).
   Arquitetura baseada no RunningCalendar; domínio adaptado para transmissões.
   ========================================================================== */

// ---------------------------------------------------------------------------
// Constantes globais
// ---------------------------------------------------------------------------
const DATA_URL = './data/transmissoes.json';
const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 220;

const FILTERS_STORAGE_KEY   = 'ondascurtas.filters.v1';
const FAVORITES_STORAGE_KEY = 'ondascurtas.favorites.v1';
const THEME_STORAGE_KEY     = 'ondascurtas.theme.v1';
const UI_STATE_STORAGE_KEY  = 'ondascurtas.uiState.v1';

const ALLOWED_THEMES = new Set(['light', 'dark']);

// Bandas ITU de radiodifusão SW em ordem de frequência crescente
const BANDA_ORDER = ['120m', '90m', '75m', '60m', '49m', '41m', '31m', '25m', '22m', '19m', '16m', '15m', '13m', '11m'];

// Cores CSS para cada banda (variável --band-color no card)
const BANDA_COLORS = {
  '120m': '#d97706', '90m': '#ca8a04', '75m': '#65a30d',
  '60m': '#16a34a',  '49m': '#10b981', '41m': '#059669',
  '31m': '#0d9488',  '25m': '#0891b2', '22m': '#0284c7',
  '19m': '#2563eb',  '16m': '#9333ea', '15m': '#8b5cf6',
  '13m': '#6d28d9',  '11m': '#7c3aed'
};

const DIAS_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// Emoji de bandeira por código ITU e EiBi custom
const ITU_FLAG = {
  AFS:'🇿🇦', ALB:'🇦🇱', ALG:'🇩🇿', ALS:'🇺🇸', ARG:'🇦🇷', ARM:'🇦🇲', AUS:'🇦🇺', AUT:'🇦🇹',
  AZE:'🇦🇿', B:'🇧🇷', BEL:'🇧🇪', BGD:'🇧🇩', BGR:'🇧🇬', BHR:'🇧🇭', BLR:'🇧🇾', BOL:'🇧🇴',
  BRA:'🇧🇷', CAN:'🇨🇦', CHN:'🇨🇳', CHL:'🇨🇱', CLA:'🏴‍☠️', CLM:'🇨🇴', CME:'🇨🇲', COG:'🇨🇬',
  CTI:'🇨🇮', CUB:'🇨🇺', CVA:'🇻🇦', CZE:'🇨🇿', D:'🇩🇪', DEU:'🇩🇪', DNK:'🇩🇰', E:'🇪🇸',
  EGY:'🇪🇬', EQA:'🇪🇨', ERI:'🇪🇷', ESP:'🇪🇸', ETH:'🇪🇹', F:'🇫🇷', FIN:'🇫🇮', FRA:'🇫🇷',
  G:'🇬🇧', GBR:'🇬🇧', GRC:'🇬🇷', GUM:'🇬🇺', HKG:'🇭🇰', HNG:'🇭🇺', HOL:'🇳🇱', HRV:'🇭🇷',
  I:'🇮🇹', IND:'🇮🇳', INS:'🇮🇩', IRL:'🇮🇪', IRN:'🇮🇷', IRQ:'🇮🇶', ISR:'🇮🇱', ITA:'🇮🇹',
  J:'🇯🇵', JPN:'🇯🇵', KAZ:'🇰🇿', KOR:'🇰🇷', KRE:'🇰🇵', KWT:'🇰🇼', LBN:'🇱🇧', LBR:'🇱🇷',
  LBY:'🇱🇾', LTU:'🇱🇹', MAR:'🇲🇦', MDA:'🇲🇩', MDG:'🇲🇬', MEX:'🇲🇽', MLA:'🇲🇾', MLI:'🇲🇱',
  MNG:'🇲🇳', MRT:'🇲🇷', MYA:'🇲🇲', NCG:'🇳🇮', NIG:'🇳🇪', NOR:'🇳🇴', NPL:'🇳🇵', NZL:'🇳🇿',
  OMN:'🇴🇲', PAK:'🇵🇰', PHL:'🇵🇭', POL:'🇵🇱', POR:'🇵🇹', PRU:'🇵🇪', QAT:'🇶🇦', ROU:'🇷🇴',
  RUS:'🇷🇺', S:'🇸🇪', SAU:'🇸🇦', SDN:'🇸🇩', SLM:'🇸🇧', SNG:'🇸🇬', SOM:'🇸🇴', SRB:'🇷🇸',
  SUI:'🇨🇭', SVK:'🇸🇰', SWZ:'🇸🇿', SYR:'🇸🇾', TCD:'🇹🇩', THA:'🇹🇭', TJK:'🇹🇯', TUN:'🇹🇳',
  TUR:'🇹🇷', TWN:'🇹🇼', UAE:'🇦🇪', UKR:'🇺🇦', UN:'🇺🇳', URG:'🇺🇾', USA:'🇺🇸', UZB:'🇺🇿',
  VEN:'🇻🇪', VTN:'🇻🇳', VUT:'🇻🇺', XUU:'🏴‍☠️', YEM:'🇾🇪'
};

// ---------------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------------
const state = {
  payload: null,        // payload completo do JSON
  transmissoes: [],     // todas as transmissões
  catalogs: {
    bandas: [],
    idiomas: [],
    paises: [],
    areas: []
  },
  filters: {
    search: '',
    bandas: new Set(),
    idiomas: new Set(),
    paises: new Set(),
    areas: new Set(),
    onlyFavorites: false,
    onlyOnAir: false
  },
  pagination: {
    bandStates: new Map(),
    bandObservers: new Map()
  },
  schedule: {
    collapsed: true
  },
  ui: {
    theme: 'light'
  },
  favorites: new Set(),
  utcClockInterval: null,
  onAirCheckInterval: null,
  lastOnAirCount: -1,
  map: null,
  mapMarkers: []
};

// ---------------------------------------------------------------------------
// Referências DOM
// ---------------------------------------------------------------------------
const elements = {
  updatedAt:             document.querySelector('#updatedAt'),
  headerTitle:           document.querySelector('#headerTitle'),
  headerSubtitlePrefix:  document.querySelector('#headerSubtitlePrefix'),
  headerTxCount:         document.querySelector('#headerTxCount'),
  headerCountLabel:      document.querySelector('#headerCountLabel'),
  headerSeason:          document.querySelector('#headerSeason'),
  onAirBadge:            document.querySelector('#onAirBadge'),
  utcClockTime:          document.querySelector('#utcClockTime'),
  tickerLabelText:       document.querySelector('#tickerLabelText'),
  tickerTrack:           document.querySelector('#tickerTrack'),
  themeToggleBtn:        document.querySelector('#themeToggleBtn'),
  searchInput:           document.querySelector('#searchInput'),

  paisDropdown:          document.querySelector('#paisDropdown'),
  paisDropdownSummary:   document.querySelector('#paisDropdownSummary'),
  paisDropdownOptions:   document.querySelector('#paisDropdownOptions'),

  idiomaDropdown:        document.querySelector('#idiomaDropdown'),
  idiomaDropdownSummary: document.querySelector('#idiomaDropdownSummary'),
  idiomaDropdownOptions: document.querySelector('#idiomaDropdownOptions'),

  areaDropdown:          document.querySelector('#areaDropdown'),
  areaDropdownSummary:   document.querySelector('#areaDropdownSummary'),
  areaDropdownOptions:   document.querySelector('#areaDropdownOptions'),

  dropdownClearButtons:  document.querySelectorAll('.multi-clear-btn'),
  bandButtons:           document.querySelector('#bandButtons'),
  clearFiltersBtn:       document.querySelector('#clearFiltersBtn'),
  favoritesToggleBtn:    document.querySelector('#favoritesToggleBtn'),
  favoritesToggleIcon:   document.querySelector('#favoritesToggleIcon'),
  favoritesToggleCount:  document.querySelector('#favoritesToggleCount'),
  onAirToggleBtn:        document.querySelector('#onAirToggleBtn'),
  scheduleToggleBtn:     document.querySelector('#scheduleToggleBtn'),
  mapToggleBtn:          document.querySelector('#mapToggleBtn'),
  mapSection:            document.querySelector('#mapSection'),
  mapContainer:          document.querySelector('#mapContainer'),
  scheduleOverview:      document.querySelector('#scheduleOverview'),
  scheduleGrid:          document.querySelector('#scheduleGrid'),
  scheduleHint:          document.querySelector('#scheduleHint'),
  
  // SDR Modal
  sdrModal:              document.querySelector('#sdrModal'),
  sdrTitleFreq:          document.querySelector('#sdrTitleFreq'),
  sdrTitleStation:       document.querySelector('#sdrTitleStation'),
  sdrCloseBtn:           document.querySelector('#sdrCloseBtn'),
  sdrIframe:             document.querySelector('#sdrIframe'),

  txList:                document.querySelector('#txList'),
  txTemplate:            document.querySelector('#txTemplate'),
  backToTopBtn:          document.querySelector('#backToTopBtn'),
  resultsSection:        document.querySelector('.results')
};

// ---------------------------------------------------------------------------
// Utilitários gerais
// ---------------------------------------------------------------------------
function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function readStorageJson(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

function writeStorageJson(key, payload) {
  try { localStorage.setItem(key, JSON.stringify(payload)); } catch { /* noop */ }
}

function readStorageValue(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorageValue(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Tema
// ---------------------------------------------------------------------------
function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialTheme() {
  const saved = String(readStorageValue(THEME_STORAGE_KEY) || '').trim().toLowerCase();
  return ALLOWED_THEMES.has(saved) ? saved : getSystemTheme();
}

function syncThemeToggleButton() {
  if (!elements.themeToggleBtn) return;
  const dark = state.ui.theme === 'dark';
  elements.themeToggleBtn.setAttribute('aria-pressed', String(dark));
  elements.themeToggleBtn.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
  elements.themeToggleBtn.setAttribute('title',      dark ? 'Ativar modo claro' : 'Ativar modo escuro');
}

function applyTheme(theme, persist = false) {
  const t = ALLOWED_THEMES.has(theme) ? theme : 'light';
  state.ui.theme = t;
  document.documentElement.dataset.theme = t;
  syncThemeToggleButton();
  syncMapTheme();
  if (persist) writeStorageValue(THEME_STORAGE_KEY, t);
}

// ---------------------------------------------------------------------------
// Relógio UTC
// ---------------------------------------------------------------------------
function utcNowMinutes() {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

function utcNowDayIndex() {
  const d = new Date().getUTCDay();
  return (d + 6) % 7;
}

function formatHHMM(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function updateUtcClock() {
  if (!elements.utcClockTime) return;
  const now = new Date();
  elements.utcClockTime.textContent = formatHHMM(now.getUTCHours(), now.getUTCMinutes());
}

function startUtcClock() {
  updateUtcClock();
  state.utcClockInterval = setInterval(updateUtcClock, 30_000);
}

// ---------------------------------------------------------------------------
// Lógica "no ar agora"
// ---------------------------------------------------------------------------
function hhmm_to_min(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function isOnAirNow(tx) {
  const nowMin = utcNowMinutes();
  const nowDay = utcNowDayIndex();
  if (!Array.isArray(tx.dias_semana) || !tx.dias_semana.includes(nowDay)) return false;
  const start = hhmm_to_min(tx.hora_inicio_utc || '00:00');
  let end = hhmm_to_min(tx.hora_fim_utc || '24:00');
  if (end === 0) end = 24 * 60;
  if (start < end) return nowMin >= start && nowMin < end;
  else return nowMin >= start || nowMin < end;
}

// ---------------------------------------------------------------------------
// Conversão UTC → local
// ---------------------------------------------------------------------------
function utcHhmmToLocal(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0));
  return formatHHMM(utcDate.getHours(), utcDate.getMinutes());
}

function localTzAbbr() {
  try {
    return Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value || '';
  } catch { return ''; }
}

// ---------------------------------------------------------------------------
// Bandas e flags
// ---------------------------------------------------------------------------
function bandaColor(banda) {
  return BANDA_COLORS[banda] || '#6b7280';
}

function flagForTx(tx) {
  return ITU_FLAG[tx.pais_itu] || '';
}

function applyBandaStyle(el, banda) {
  const color = bandaColor(banda);
  el.style.setProperty('--band-color', color);
  el.style.setProperty('--band-bg', `color-mix(in srgb, ${color} 10%, var(--surface-2))`);
}

// ---------------------------------------------------------------------------
// Busca e Filtros
// ---------------------------------------------------------------------------
function buildTxSearchText(tx) {
  return normalizeText(`${tx.estacao || ''} ${tx.idioma || ''} ${tx.area_alvo || ''} ${tx.pais_origem || ''} ${tx.freq_khz || ''}`);
}

function matchesSearch(tx, query) {
  if (!query) return true;
  return (tx._searchText || buildTxSearchText(tx)).includes(query);
}


function indexForSearch(transmissoes) {
  transmissoes.forEach(tx => { tx._searchText = buildTxSearchText(tx); });
}
function applyFilters() {
  const query = normalizeText(state.filters.search);
  return state.transmissoes.filter(tx => {
    if (state.filters.bandas.size  > 0 && !state.filters.bandas.has(tx.banda_metros))   return false;
    if (state.filters.idiomas.size > 0 && !state.filters.idiomas.has(tx.idioma))        return false;
    if (state.filters.paises.size  > 0 && !state.filters.paises.has(tx.pais_origem))    return false;
    if (state.filters.areas.size   > 0 && !state.filters.areas.has(tx.area_alvo))       return false;
    if (state.filters.onlyFavorites && !isTxFavorite(tx))                                return false;
    if (state.filters.onlyOnAir && !isOnAirNow(tx))                                     return false;
    if (!matchesSearch(tx, query))                                                       return false;
    return true;
  }).sort((a, b) => {
    const aOn = isOnAirNow(a) ? 0 : 1;
    const bOn = isOnAirNow(b) ? 0 : 1;
    if (aOn !== bOn) return aOn - bOn;
    const aBand = BANDA_ORDER.indexOf(a.banda_metros);
    const bBand = BANDA_ORDER.indexOf(b.banda_metros);
    if (aBand !== bBand) return aBand - bBand;
    return (a.freq_khz || 0) - (b.freq_khz || 0);
  });
}

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------
function getTxFavoriteKey(tx) { return tx?.id ? `id:${tx.id}` : ''; }
function isTxFavorite(tx) { return !!getTxFavoriteKey(tx) && state.favorites.has(getTxFavoriteKey(tx)); }

function loadPersistedFavorites() {
  const arr = readStorageJson(FAVORITES_STORAGE_KEY);
  if (!Array.isArray(arr)) return;
  state.favorites = new Set(arr.map(v => String(v || '').trim()).filter(Boolean));
}
function toggleFavoriteByKey(key) {
  if (!key) return;
  if (state.favorites.has(key)) state.favorites.delete(key);
  else state.favorites.add(key);
  persistFavorites();
  syncFavoritesToggleButton();
}
function persistFavorites() { writeStorageJson(FAVORITES_STORAGE_KEY, Array.from(state.favorites)); }
function syncFavoritesToggleButton() {
  const active = !!state.filters.onlyFavorites;
  if (elements.favoritesToggleIcon) elements.favoritesToggleIcon.textContent = active ? '★' : '☆';
}

// ---------------------------------------------------------------------------
// Renderização de Cards
// ---------------------------------------------------------------------------
function createTxCardElement(tx) {
  const tmpl = elements.txTemplate.content.cloneNode(true);
  const card = tmpl.querySelector('.tx-card');
  const onAir = isOnAirNow(tx);
  if (onAir) card.classList.add('tx-card--on-air');

  tmpl.querySelector('.freq-khz').textContent = tx.freq_khz;
  const bandaEl = tmpl.querySelector('.freq-banda');
  bandaEl.textContent = tx.banda_metros || '';
  applyBandaStyle(bandaEl, tx.banda_metros);

  const txKey = getTxFavoriteKey(tx);
  card.dataset.txKey = txKey;
  
  const titleLink = tmpl.querySelector('.card-estacao-name');
  titleLink.textContent = tx.estacao || '—';
  
  if (tx.freq_khz && onAir) {
    titleLink.classList.add('sdr-link--on-air');
    titleLink.title = "Ouvir no WebSDR (No Ar Agora)";
    titleLink.addEventListener('click', (e) => {
      e.preventDefault();
      openSdrModal(tx.freq_khz, tx.estacao || 'Desconhecida');
    });
  } else {
    titleLink.style.pointerEvents = 'none';
    titleLink.style.textDecoration = 'none';
    titleLink.style.color = 'inherit';
    titleLink.removeAttribute('href');
    titleLink.title = "";
  }

  const favBtn = tmpl.querySelector('.favorite-btn');
  if (favBtn) {
    favBtn.dataset.txKey = txKey;
    const isFav = state.favorites.has(txKey);
    favBtn.textContent = isFav ? '★' : '☆';
    favBtn.classList.toggle('favorite-btn--active', isFav);
    
    favBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavoriteByKey(txKey);
      
      const nowFav = state.favorites.has(txKey);
      // Update all favorite buttons for this txKey on screen
      document.querySelectorAll(`.favorite-btn[data-tx-key="${txKey}"]`).forEach(btn => {
        btn.textContent = nowFav ? '★' : '☆';
        btn.classList.toggle('favorite-btn--active', nowFav);
      });
      
      if (state.filters.onlyFavorites && !nowFav) {
        renderAll();
      }
    });
  }
  
  tmpl.querySelector('.card-pais-flag').textContent = flagForTx(tx);
  tmpl.querySelector('.card-pais-name').textContent = tx.pais_origem || tx.pais_itu || '—';

  const potEl = tmpl.querySelector('.tx-potencia');
  if (potEl) {
    if (tx.potencia_kw) potEl.textContent = `${tx.potencia_kw} kW`;
    else potEl.hidden = true;
  }

  const idiomaEl = tmpl.querySelector('.meta-tag--idioma');
  if (idiomaEl) {
    if (tx.idioma) {
      const langs = tx.idioma.split(' / ');
      if (langs.length >= 3) {
        idiomaEl.textContent = `${langs[0]} / ${langs[1]} +${langs.length - 2}`;
        idiomaEl.title = tx.idioma;
        idiomaEl.style.cursor = 'help';
      } else {
        idiomaEl.textContent = tx.idioma;
        idiomaEl.title = '';
      }
    } else {
      idiomaEl.hidden = true;
    }
  }
  
  const areaEl = tmpl.querySelector('.meta-tag--area');
  if (areaEl) {
    if (tx.area_alvo) areaEl.textContent = tx.area_alvo;
    else areaEl.hidden = true;
  }

  const dias = Array.isArray(tx.dias_semana) ? tx.dias_semana : [];
  
  if (dias.length === 7) {
    tmpl.querySelector('.card-days').hidden = true;
    tmpl.querySelector('.sched-utc').textContent = `${tx.hora_inicio_utc || '--:--'} – ${tx.hora_fim_utc || '--:--'} UTC (Diário)`;
  } else {
    tmpl.querySelector('.sched-utc').textContent = `${tx.hora_inicio_utc || '--:--'} – ${tx.hora_fim_utc || '--:--'} UTC`;
    tmpl.querySelectorAll('.day-chip').forEach(chip => {
      const d = parseInt(chip.dataset.day, 10);
      if (dias.includes(d)) {
        chip.classList.add('day-chip--active');
      }
    });
  }

  return card;
}

// ---------------------------------------------------------------------------
// Renderização das transmissões
// ---------------------------------------------------------------------------
function groupByBanda(transmissoes) {
  const groups = new Map();
  transmissoes.forEach(tx => {
    const key = tx.banda_metros || '?';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  });
  return groups;
}

function renderRaces(filteredTx) {
  elements.txList.innerHTML = '';
  
  const groups = groupByBanda(filteredTx);
  
  if (groups.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Nenhuma transmissão encontrada com os filtros selecionados.';
    elements.txList.appendChild(empty);
    return;
  }

  // Limpa observers antigos
  if (state.pagination.bandObservers) {
    state.pagination.bandObservers.forEach(obs => obs.disconnect());
  }
  state.pagination.bandObservers = new Map();
  state.pagination.bandStates = new Map();

  for (const [bandaKey, txs] of groups.entries()) {
    const section = document.createElement('section');
    section.className = 'band-group';
    const header = document.createElement('header');
    header.className = 'band-divider';
    const label = document.createElement('span');
    label.className = 'band-divider-label';
    label.textContent = bandaKey;
    applyBandaStyle(label, bandaKey);
    header.append(label, document.createElement('div'));
    
    const container = document.createElement('div');
    container.className = 'band-cards';
    const sentinel = document.createElement('div');
    sentinel.className = 'band-sentinel';
    sentinel.style.height = '1px';
    
    section.append(header, container, sentinel);
    elements.txList.appendChild(section);

    state.pagination.bandStates.set(bandaKey, {
      txs: txs,
      renderedCount: 0,
      container: container,
      sentinel: sentinel
    });

    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        appendNextTxBatchForBand(bandaKey);
      }
    }, { root: null, rootMargin: '400px', threshold: 0 });
    
    observer.observe(sentinel);
    state.pagination.bandObservers.set(bandaKey, observer);
    appendNextTxBatchForBand(bandaKey);
  }
}

function appendNextTxBatchForBand(bandaKey) {
  const bandState = state.pagination.bandStates.get(bandaKey);
  if (!bandState) return;

  const { txs, renderedCount, container, sentinel } = bandState;
  if (renderedCount >= txs.length) {
    sentinel.hidden = true;
    return;
  }

  const nextCount = Math.min(renderedCount + PAGE_SIZE, txs.length);
  const frag = document.createDocumentFragment();

  for (let i = renderedCount; i < nextCount; i++) {
    frag.appendChild(createTxCardElement(txs[i]));
  }

  container.appendChild(frag);
  bandState.renderedCount = nextCount;
  if (nextCount >= txs.length) sentinel.hidden = true;
}

// ---------------------------------------------------------------------------
// Constantes de banda
// ---------------------------------------------------------------------------
const BANDA_FREQUENCIES = {
  '120m': '2300–2495 kHz', '90m': '3200–3400 kHz', '75m': '3900–4000 kHz',
  '60m': '4750–5060 kHz',  '49m': '5900–6200 kHz',  '41m': '7200–7450 kHz',
  '31m': '9400–9900 kHz',  '25m': '11600–12100 kHz', '22m': '13570–13870 kHz',
  '19m': '15100–15800 kHz','16m': '17480–17900 kHz', '15m': '18900–19020 kHz',
  '13m': '21450–21850 kHz','11m': '25600–26100 kHz'
};


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


// ---------------------------------------------------------------------------
// Grade horária 7×24
// ---------------------------------------------------------------------------
function renderScheduleGrid(filteredTx) {
  if (!elements.scheduleGrid) return;
  if (!elements.scheduleOverview || elements.scheduleOverview.hidden) return;

  elements.scheduleGrid.innerHTML = '';

  const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));
  filteredTx.forEach(tx => {
    const start = Math.floor(hhmm_to_min(tx.hora_inicio_utc || '00:00') / 60);
    let end = Math.floor(hhmm_to_min(tx.hora_fim_utc || '24:00') / 60);
    if (end === 0 || end > 24) end = 24;
    (tx.dias_semana || []).forEach(day => {
      for (let h = start; h < end; h++) {
        if (h < 24) matrix[day][h]++;
      }
    });
  });

  const maxCount = Math.max(1, ...matrix.flat());
  const nowDay  = utcNowDayIndex();
  const nowHour = new Date().getUTCHours();

  const frag = document.createDocumentFragment();

  const cornerCell = document.createElement('div');
  cornerCell.className = 'sched-col-header';
  cornerCell.textContent = 'UTC→';
  frag.appendChild(cornerCell);

  for (let h = 0; h < 24; h++) {
    const cell = document.createElement('div');
    cell.className = 'sched-col-header';
    cell.textContent = String(h).padStart(2, '0');
    frag.appendChild(cell);
  }

  for (let d = 0; d < 7; d++) {
    const rowLabel = document.createElement('div');
    rowLabel.className = 'sched-row-label';
    rowLabel.textContent = DIAS_LABELS[d];
    frag.appendChild(rowLabel);

    for (let h = 0; h < 24; h++) {
      const count = matrix[d][h];
      const cell = document.createElement('div');
      cell.className = 'sched-cell';
      const ratio = count / maxCount;
      if (count === 0) cell.classList.add('sched-cell--empty');
      else if (ratio < 0.33) cell.classList.add('sched-cell--low');
      else if (ratio < 0.66) cell.classList.add('sched-cell--mid');
      else cell.classList.add('sched-cell--high');

      if (d === nowDay && h === nowHour) cell.classList.add('sched-cell--now');

      cell.title = `${DIAS_LABELS[d]} ${String(h).padStart(2,'0')}:00 UTC — ${count} transmissão(ões)`;
      frag.appendChild(cell);
    }
  }

  elements.scheduleGrid.appendChild(frag);

  const totalCells = matrix.flat().reduce((a, b) => a + b, 0);
  if (elements.scheduleHint) {
    elements.scheduleHint.textContent = `${filteredTx.length} transmissões · ${totalCells} janelas/hora`;
  }
}

function setScheduleCollapsed(collapsed) {
  state.schedule.collapsed = !!collapsed;
  if (elements.scheduleOverview) elements.scheduleOverview.hidden = !!collapsed;
  
  if (elements.mapToggleBtn) {
    elements.mapToggleBtn.addEventListener('click', () => {
      const isExpanded = elements.mapToggleBtn.getAttribute('aria-expanded') === 'true';
      elements.mapToggleBtn.setAttribute('aria-expanded', String(!isExpanded));
      elements.mapSection.hidden = isExpanded;
      if (!isExpanded && state.map) {
        state.map.invalidateSize();
      }
    });
  }

  if (elements.scheduleToggleBtn) {
    elements.scheduleToggleBtn.classList.toggle('schedule-filter-btn--active', !collapsed);
    elements.scheduleToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    elements.scheduleToggleBtn.setAttribute('aria-pressed', String(!collapsed));
    elements.scheduleToggleBtn.setAttribute('aria-label', collapsed ? 'Mostrar grade horária' : 'Ocultar grade horária');
    elements.scheduleToggleBtn.setAttribute('title',      collapsed ? 'Mostrar grade horária' : 'Ocultar grade horária');
  }
}

function syncBackToTopButton() {
  if (!elements.backToTopBtn) return;
  const doc = document.documentElement;
  const scrollable = Math.max(0, doc.scrollHeight - window.innerHeight);
  const current = window.scrollY || 0;
  const show = scrollable > 280 && current >= scrollable * 0.5;
  elements.backToTopBtn.hidden = !show;
  elements.backToTopBtn.classList.toggle('back-to-top--visible', show);
}

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

    const sortedTxs = [...txs].sort((a, b) => a.freq - b.freq);
    
    const popupContainer = document.createElement('div');
    popupContainer.className = 'map-popup';
    popupContainer.style.minWidth = '300px';
    
    const header = document.createElement('div');
    header.style.fontWeight = '700';
    header.style.marginBottom = '8px';
    header.style.paddingBottom = '4px';
    header.style.borderBottom = '2px solid var(--border-color)';
    header.innerHTML = `${txs[0].pais_origem || itu} <span style="color: var(--text-muted); font-size: 0.8em; font-weight: normal;">(${count})</span>`;
    popupContainer.appendChild(header);

    const cardsContainer = document.createElement('div');
    cardsContainer.style.maxHeight = '300px';
    cardsContainer.style.overflowY = 'auto';
    cardsContainer.style.display = 'flex';
    cardsContainer.style.flexDirection = 'column';
    cardsContainer.style.gap = '0.5rem';
    cardsContainer.style.paddingRight = '4px';

    sortedTxs.forEach(t => {
      const card = createTxCardElement(t);
      card.style.flexShrink = '0'; // Evita o bug do flexbox esmagar os cards
      card.classList.add('tx-card--popup');
      cardsContainer.appendChild(card);
    });

    popupContainer.appendChild(cardsContainer);

    marker.bindPopup(popupContainer, { maxWidth: 340 });
    marker.addTo(state.map);
    state.mapMarkers.push(marker);
  });
}


// ---------------------------------------------------------------------------
// renderAll — ponto central de atualização
// ---------------------------------------------------------------------------
let _renderAllTimer = 0;

function syncUIState() {
  syncBandButtons();
  syncFavoritesToggleButton();
  syncOnAirToggleButton();
  syncClearFiltersButton();
  syncMultiDropdownSelection(elements.paisDropdownOptions,   state.filters.paises);
  syncMultiDropdownSelection(elements.idiomaDropdownOptions, state.filters.idiomas);
  syncMultiDropdownSelection(elements.areaDropdownOptions,   state.filters.areas);
  updateDropdownSummaries();
  updateDropdownClearButtons();
}

function renderAll(immediate = false) {
  // 1. Atualiza a interface dos filtros imediatamente (resposta visual instantânea)
  syncUIState();

  // 2. Debounce para a renderização pesada da lista
  clearTimeout(_renderAllTimer);
  
  const doHeavyRender = () => {
    const filtered = applyFilters();
    renderHeaderTicker(filtered);
    renderRaces(filtered);
  renderMapMarkers(filtered);
    renderScheduleGrid(filtered);
    updateOnAirCount();
    syncBackToTopButton();
    persistFilters();
  };

  if (immediate) {
    doHeavyRender();
  } else {
    // Atraso de 80ms é imperceptível para a lista, mas permite que o clique do usuário seja processado fluidamente.
    _renderAllTimer = setTimeout(doHeavyRender, 80);
  }
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
function bindEvents() {
  // Tema
  elements.themeToggleBtn?.addEventListener('click', () => {
    applyTheme(state.ui.theme === 'dark' ? 'light' : 'dark', true);
  });

  
  // SDR Modal
  elements.sdrCloseBtn?.addEventListener('click', closeSdrModal);
  elements.sdrModal?.addEventListener('close', closeSdrModal);
  elements.sdrModal?.addEventListener('click', e => {
    if (e.target === elements.sdrModal) closeSdrModal(); // Close on backdrop click
  });

  // Back to top
  elements.backToTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Grade horária toggle
  elements.scheduleToggleBtn?.addEventListener('click', () => {
    setScheduleCollapsed(!state.schedule.collapsed);
    if (!state.schedule.collapsed) renderScheduleGrid(applyFilters());
  });

  // Mapa toggle
  elements.mapToggleBtn?.addEventListener('click', () => {
    const isExpanded = elements.mapToggleBtn.getAttribute('aria-expanded') === 'true';
    elements.mapToggleBtn.setAttribute('aria-expanded', String(!isExpanded));
    elements.mapSection.hidden = isExpanded;
    if (!isExpanded && state.map) {
      state.map.invalidateSize();
    }
  });

  // Busca com debounce já usa o setTimeout interno do renderAll, mas mantemos o input fluido
  elements.searchInput?.addEventListener('input', e => {
    state.filters.search = e.target.value;
    renderAll();
  });

  // Dropdowns — clique nas opções
  elements.paisDropdownOptions?.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const btn = e.target.closest('.multi-option-btn');
    if (!btn) return;
    const v = btn.dataset.value || '';
    if (!v) return;
    if (state.filters.paises.has(v)) state.filters.paises.delete(v);
    else state.filters.paises.add(v);
    const keepOpen = !!elements.paisDropdown?.open;
    renderAll();
    if (keepOpen) elements.paisDropdown.open = true;
  });

  elements.idiomaDropdownOptions?.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const btn = e.target.closest('.multi-option-btn');
    if (!btn) return;
    const v = btn.dataset.value || '';
    if (!v) return;
    if (state.filters.idiomas.has(v)) state.filters.idiomas.delete(v);
    else state.filters.idiomas.add(v);
    const keepOpen = !!elements.idiomaDropdown?.open;
    renderAll();
    if (keepOpen) elements.idiomaDropdown.open = true;
  });

  elements.areaDropdownOptions?.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const btn = e.target.closest('.multi-option-btn');
    if (!btn) return;
    const v = btn.dataset.value || '';
    if (!v) return;
    if (state.filters.areas.has(v)) state.filters.areas.delete(v);
    else state.filters.areas.add(v);
    const keepOpen = !!elements.areaDropdown?.open;
    renderAll();
    if (keepOpen) elements.areaDropdown.open = true;
  });

  // Clear buttons nos dropdowns
  elements.dropdownClearButtons.forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault());
  });

  document.addEventListener('click', e => {
    const clearBtn = e.target.closest('.multi-clear-btn');
    if (!clearBtn) return;
    e.preventDefault(); e.stopPropagation();
    const type = clearBtn.dataset.dropdown || '';
    if (type === 'pais')   state.filters.paises.clear();
    if (type === 'idioma') state.filters.idiomas.clear();
    if (type === 'area')   state.filters.areas.clear();
    renderAll();
  });

  // Fechar dropdowns ao clicar fora
  [elements.paisDropdown, elements.idiomaDropdown, elements.areaDropdown].forEach(d => {
    if (!d) return;
    d.addEventListener('toggle', () => { if (d.open) closeAllDropdowns(d); });
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.multi-dropdown')) closeAllDropdowns();
  });

  // Filtros de banda
  elements.bandButtons?.addEventListener('click', e => {
    const btn = e.target.closest('.band-filter-btn');
    if (!btn) return;
    const banda = btn.dataset.banda || '';
    if (!banda) return;
    if (state.filters.bandas.has(banda)) state.filters.bandas.delete(banda);
    else state.filters.bandas.add(banda);
    renderAll();
  });

  // Clear all filters
  elements.clearFiltersBtn?.addEventListener('click', () => {
    clearAllFilters();
    closeAllDropdowns();
    renderAll();
  });

  // Toggle "somente no ar agora"
  elements.onAirToggleBtn?.addEventListener('click', () => {
    state.filters.onlyOnAir = !state.filters.onlyOnAir;
    renderAll();
  });

  // Toggle favoritos
  elements.favoritesToggleBtn?.addEventListener('click', () => {
    state.filters.onlyFavorites = !state.filters.onlyFavorites;
    renderAll();
  });

  // Clique no card — favorito (removido daqui, agora é direto no botão em createTxCardElement)
  
  // Scroll
  window.addEventListener('scroll', () => { syncBackToTopButton(); }, { passive: true });
  window.addEventListener('resize', () => { syncBackToTopButton(); }, { passive: true });
}

// ---------------------------------------------------------------------------
// Refresh periódico do indicador "no ar"
// ---------------------------------------------------------------------------
function startOnAirRefresh() {
  // A cada minuto: re-renderiza apenas o badge de count e o ticker
  state.onAirCheckInterval = setInterval(() => {
    updateOnAirCount();
    renderHeaderTicker(applyFilters());
    // Atualiza visualmente os cards visíveis (sem re-renderizar a lista inteira)
    document.querySelectorAll('.tx-card').forEach(card => {
      const key = card.dataset.txKey;
      if (!key) return;
      const tx = state.transmissoes.find(t => getTxFavoriteKey(t) === key);
      if (!tx) return;
      const onAir = isOnAirNow(tx);
      card.classList.toggle('tx-card--on-air', onAir);
      const badge = card.querySelector('.on-air-badge');
      if (badge) badge.hidden = !onAir;
    });
  }, 60_000);
}

// ---------------------------------------------------------------------------
// Formatação de data atualizado
// ---------------------------------------------------------------------------
function formatUpdatedAt(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC'
  }).format(parsed) + ' UTC';
}

// ---------------------------------------------------------------------------
// Render de erro
// ---------------------------------------------------------------------------
function renderError(message) {
  elements.txList.innerHTML = '';
  const errEl = document.createElement('div');
  errEl.className = 'error';
  errEl.textContent = message;
  elements.txList.appendChild(errEl);
  if (elements.headerTxCount) elements.headerTxCount.textContent = '-';
  if (elements.tickerTrack) {
    elements.tickerTrack.innerHTML = '';
    const empty = document.createElement('span');
    empty.className = 'ticker-item';
    empty.textContent = 'Erro ao carregar dados.';
    elements.tickerTrack.appendChild(empty);
    elements.tickerTrack.classList.add('ticker-track--static');
  }
}


// ---------------------------------------------------------------------------
// SDR Modal Logic
// ---------------------------------------------------------------------------
function openSdrModal(freq, station) {
  if (!elements.sdrModal) return;
  elements.sdrTitleFreq.textContent = freq + ' kHz';
  elements.sdrTitleStation.textContent = station;
  // Use UTwente WebSDR
  elements.sdrIframe.src = 'http://websdr.ewi.utwente.nl:8901/?tune=' + freq + 'am';
  elements.sdrModal.showModal();
}

function closeSdrModal() {
  if (!elements.sdrModal) return;
  elements.sdrModal.close();
  elements.sdrIframe.src = 'about:blank'; // Parar o áudio
}

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
async function init() {
  applyTheme(getInitialTheme());
  loadPersistedFavorites();
  startUtcClock();
  await loadCountryCoords();
  initMap();
  bindEvents();

  try {
    const resp = await fetch(DATA_URL, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const payload = await resp.json();
    state.payload = payload;

    const txs = Array.isArray(payload.transmissoes) ? payload.transmissoes : [];
    state.transmissoes = txs;
    indexForSearch(txs);

    // Catálogos
    state.catalogs = buildCatalogFromTx(txs);

    // Renderiza dropdowns
    renderMultiDropdownOptions(
      elements.paisDropdownOptions,
      state.catalogs.paises,
      v => v,
      'pais'
    );
    renderMultiDropdownOptions(
      elements.idiomaDropdownOptions,
      state.catalogs.idiomas,
      v => v,
      'idioma'
    );
    renderMultiDropdownOptions(
      elements.areaDropdownOptions,
      state.catalogs.areas,
      v => v,
      'area'
    );

    // Metadados do header
    if (elements.updatedAt) {
      elements.updatedAt.textContent = formatUpdatedAt(payload.generated_at);
    }
    if (elements.headerSeason && payload.temporada) {
      elements.headerSeason.textContent = payload.temporada;
    }

    // Restaura filtros persistidos
    loadPersistedFilters();
    syncOnAirToggleButton();

    renderAll();
    startOnAirRefresh();

  } catch (err) {
    renderError('Não foi possível carregar os dados. Tente recarregar a página.');
    console.error('[OndasCurtas] init error:', err);
  }
}

init();
