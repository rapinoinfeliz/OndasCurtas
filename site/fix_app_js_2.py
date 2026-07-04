import re

with open('app.js', 'r') as f:
    content = f.read()

missing_code = """
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
  if (elements.scheduleToggleBtn) {
    elements.scheduleToggleBtn.classList.toggle('schedule-filter-btn--active', !collapsed);
    elements.scheduleToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    elements.scheduleToggleBtn.setAttribute('aria-pressed', String(!collapsed));
    elements.scheduleToggleBtn.setAttribute('aria-label', collapsed ? 'Mostrar grade horária' : 'Ocultar grade horária');
    elements.scheduleToggleBtn.setAttribute('title',      collapsed ? 'Mostrar grade horária' : 'Ocultar grade horária');
  }
}

"""

insert_idx = content.find("function syncBackToTopButton()")
if insert_idx != -1:
    new_content = content[:insert_idx] + missing_code + content[insert_idx:]
    with open('app.js', 'w') as f:
        f.write(new_content)
    print("Fixed app.js")
else:
    print("Could not find insertion point")
