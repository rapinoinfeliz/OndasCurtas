function renderRaces(filteredTx) {
  elements.txList.innerHTML = '';
  
  const { groups, lookup } = groupByBanda(filteredTx);
  
  if (groups.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Nenhuma transmissão encontrada.';
    elements.txList.appendChild(empty);
    return;
  }

  // Observers per band
  if (state.pagination.bandObservers) {
    state.pagination.bandObservers.forEach(obs => obs.disconnect());
  }
  state.pagination.bandObservers = new Map();
  state.pagination.bandStates = new Map();

  for (const [bandaKey, txs] of groups.entries()) {
    const meta = lookup.get(bandaKey);
    
    const section = document.createElement('section');
    section.className = 'band-group';

    const header = document.createElement('header');
    header.className = 'band-divider';
    
    const label = document.createElement('span');
    label.className = 'band-divider-label';
    label.textContent = bandaKey;
    // applyBandaStyle(label, bandaKey);

    const countEl = document.createElement('span');
    countEl.className = 'band-divider-count';
    const freq_lo = BANDA_FREQUENCIES[bandaKey] || '';
    countEl.textContent = `${meta.total} transmissões`;

    header.append(label, countEl);
    
    const container = document.createElement('div');
    container.className = 'band-cards';
    
    const sentinel = document.createElement('div');
    sentinel.className = 'band-sentinel';
    sentinel.style.height = '20px';
    
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
    }, { root: container, rootMargin: '200px', threshold: 0 });
    
    observer.observe(sentinel);
    state.pagination.bandObservers.set(bandaKey, observer);
    
    // Initial render for this band
    appendNextTxBatchForBand(bandaKey);
  }
}
