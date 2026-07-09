import { parseFlexible } from '../utils/parseFlexible.js';

export class UIController {
  constructor(store, dataService, chartService) {
    this.store = store;
    this.dataService = dataService;
    this.chartService = chartService;

    this.fileInput = document.getElementById('fileUpload');
    this.xAxisSelect = document.getElementById('xAxisSelect');
    this.valueSelect = document.getElementById('valueSelect');
    this.valueFormatSelect = document.getElementById('valueFormatSelect');
    this.segmentFieldSelect = document.getElementById('segmentFieldSelect');
    this.segmentValueSelect = document.getElementById('segmentValueSelect');
    this.chartTypeSelect = document.getElementById('chartTypeSelect');
    this.showCardsCheckbox = document.getElementById('showCards');
    this.kpiFilterSelect = document.getElementById('kpiFilterSelect');
    this.addKPIBtn = document.getElementById('addKPIBtn');
    this.kpiFilterChips = document.getElementById('kpiFilterChips');
    this.dashboardSelect = document.getElementById('dashboardSelect');
    this.newDashboardBtn = document.getElementById('newDashboardBtn');
    this.saveDashboardBtn = document.getElementById('saveDashboardBtn');
    this.deleteDashboardBtn = document.getElementById('deleteDashboardBtn');
    this.controls = document.getElementById('controls');
    this.kpiContainer = document.getElementById('kpiContainer');
    this.loader = document.getElementById('loader');
    this.loaderText = document.getElementById('loaderText');
    this.errorMessage = document.getElementById('errorMessage');
    this.debugInfo = document.getElementById('debugInfo');
    this.debugSample = document.getElementById('debugSample');
    this.kpiOptions = [
      { value: 'total', label: 'Total' },
      { value: 'average', label: 'Promedio' },
      { value: 'count', label: 'Conteo' },
      { value: 'min', label: 'Mínimo' },
      { value: 'max', label: 'Máximo' },
      { value: 'median', label: 'Mediana' },
      { value: 'std', label: 'Desviación' },
      { value: 'unique', label: 'Únicos' },
      { value: 'p90', label: 'P90' },
      { value: 'p95', label: 'P95' },
      { value: 'mad', label: 'MAD' },
      { value: 'nulls', label: 'Nulos' },
      { value: 'posSum', label: 'Suma Positivos' },
      { value: 'negSum', label: 'Suma Negativos' }
    ];
    this.selectedKPIs = new Set(['total', 'average', 'count']);

    this.bindEvents();
    this.updateKPIFilterUI();

    // load dashboards from storage
    this.loadDashboards();

    // React to state changes
    this.store.subscribe(state => this.onStateChange(state));
  }

  bindEvents() {
    if (this.fileInput) {
      this.fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          console.debug('[UIController] file selected', { name: file.name, size: file.size });
          this.showError(null);
          this.showLoader(true, 'Procesando archivo...');
          const cleaned = await this.dataService.loadFile(file);
          console.debug('[UIController] loadFile resolved, rows:', cleaned && cleaned.length);
          this.populateSelectors();
          this.controls.classList.remove('hidden');
          // set defaults
          const headers = Object.keys(this.store.getState().raw[0] || {});
          console.debug('[UIController] headers detected', headers);
          if (this.xAxisSelect && headers[0]) this.xAxisSelect.value = headers[0];
          if (this.valueSelect && headers[1]) this.valueSelect.value = headers[1];
          this.store.setState({ xAxis: headers[0] || null, valueKey: headers[1] || null });
          this.showLoader(false);
        } catch (err) {
          console.error('Error loading file', err);
          this.showLoader(false);
          this.showError(err && err.message ? err.message : String(err));
        }
      });
    }

    const onControlChange = () => {
      this.store.setState({
        xAxis: this.xAxisSelect.value,
        valueKey: this.valueSelect.value,
        valueFormat: this.valueFormatSelect ? this.valueFormatSelect.value : 'auto',
        segmentField: this.segmentFieldSelect ? this.segmentFieldSelect.value : null,
        segmentValue: this.segmentValueSelect ? this.segmentValueSelect.value : null,
        chartType: this.chartTypeSelect.value,
        showCards: this.showCardsCheckbox.checked
      });
    };
    const listenEls = [this.xAxisSelect, this.valueSelect, this.chartTypeSelect, this.showCardsCheckbox, this.segmentValueSelect, this.valueFormatSelect];
    listenEls.forEach(el => {
      if (!el) return;
      el.addEventListener('change', onControlChange);
    });
    if (this.segmentFieldSelect) {
      this.segmentFieldSelect.addEventListener('change', (e) => {
        const f = e.target.value;
        if (f) this.populateSegmentValues(f);
        onControlChange();
      });
    }
    if (this.kpiFilterSelect) {
      this.kpiFilterSelect.addEventListener('change', () => {
        const value = this.kpiFilterSelect.value;
        if (value) {
          this.toggleKPI(value, true);
          this.kpiFilterSelect.value = '';
        }
      });
    }
    if (this.addKPIBtn) {
      this.addKPIBtn.addEventListener('click', () => {
        const value = this.kpiFilterSelect ? this.kpiFilterSelect.value : null;
        if (value) {
          this.toggleKPI(value, true);
          this.kpiFilterSelect.value = '';
        }
      });
    }
    if (this.kpiFilterChips) {
      this.kpiFilterChips.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-kpi]');
        if (!chip) return;
        const kpi = chip.getAttribute('data-kpi');
        if (kpi) this.toggleKPI(kpi, false);
      });
    }

    // dashboard controls
    if (this.newDashboardBtn) this.newDashboardBtn.addEventListener('click', () => this.createNewDashboard());
    if (this.saveDashboardBtn) this.saveDashboardBtn.addEventListener('click', () => this.saveCurrentDashboard());
    if (this.deleteDashboardBtn) this.deleteDashboardBtn.addEventListener('click', () => this.deleteCurrentDashboard());
    if (this.dashboardSelect) this.dashboardSelect.addEventListener('change', (e) => this.switchToDashboard(e.target.value));
    
    // PDF download
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', () => this.downloadDashboardPDF());
    }
  }

  // --- dashboards (localStorage) ---
  loadDashboards() {
    try {
      const raw = localStorage.getItem('dashboards_v1');
      this.dashboards = raw ? JSON.parse(raw) : [];
    } catch (e) { this.dashboards = []; }
    this.populateDashboardSelect();
    if (this.dashboards.length > 0) {
      this.switchToDashboard(this.dashboards[0].id);
    }
  }

  persistDashboards() {
    try { localStorage.setItem('dashboards_v1', JSON.stringify(this.dashboards)); } catch (e) { console.warn('Could not persist dashboards', e); }
  }

  populateDashboardSelect() {
    if (!this.dashboardSelect) return;
    if (this.dashboards.length === 0) {
      this.dashboardSelect.innerHTML = '<option value="">(ninguno)</option>';
      this.updateDashboardActionState();
      return;
    }
    const current = this.dashboardSelect ? this.dashboardSelect.value : null;
    this.dashboardSelect.innerHTML = this.dashboards.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    if (current && this.dashboards.some(d => d.id === current)) {
      this.dashboardSelect.value = current;
    } else {
      this.dashboardSelect.value = this.dashboards[0].id;
    }
    this.updateDashboardActionState();
  }

  updateDashboardActionState() {
    const hasSelection = this.dashboardSelect && this.dashboardSelect.value;
    if (this.saveDashboardBtn) this.saveDashboardBtn.disabled = !hasSelection;
    if (this.deleteDashboardBtn) this.deleteDashboardBtn.disabled = !hasSelection;
  }

  createNewDashboard() {
    const name = window.prompt('Nombre del dashboard nuevo:', `Dashboard ${this.dashboards.length+1}`);
    if (!name) return;
    const id = String(Date.now());
    // create an empty/default dashboard state (don't copy large `raw` by default)
    const snapshot = Object.assign({ raw: [], xAxis: null, valueKey: null, chartType: 'bar', showCards: true, valueFormat: 'auto', parsedMeta: {}, kpiKeys: Array.from(this.selectedKPIs) });
    this.dashboards.unshift({ id, name, state: snapshot });
    this.persistDashboards();
    this.populateDashboardSelect();
    this.dashboardSelect.value = id;
    this.switchToDashboard(id);
  }

  saveCurrentDashboard() {
    if (!this.dashboardSelect) return; const id = this.dashboardSelect.value; if (!id) return;
    const idx = this.dashboards.findIndex(d => d.id === id); if (idx === -1) return;
    const newState = Object.assign({}, this.store.getState(), { kpiKeys: Array.from(this.selectedKPIs) });
    this.dashboards[idx].state = newState;
    this.persistDashboards();
    window.alert('Dashboard guardado');
  }

  deleteCurrentDashboard() {
    if (!this.dashboardSelect) return; const id = this.dashboardSelect.value; if (!id) return;
    const idx = this.dashboards.findIndex(d => d.id === id); if (idx === -1) return;
    if (!window.confirm('¿Borrar dashboard "' + this.dashboards[idx].name + '"?')) return;
    this.dashboards.splice(idx,1); this.persistDashboards(); this.populateDashboardSelect();
    if (this.dashboards.length>0) this.switchToDashboard(this.dashboards[0].id);
  }

  switchToDashboard(id) {
    const d = this.dashboards.find(x => x.id === id); if (!d) return;
    // apply saved state to store (replace keys present in snapshot)
    const s = Object.assign({}, d.state || {});
    if (Array.isArray(s.kpiKeys) && s.kpiKeys.length > 0) {
      this.selectedKPIs = new Set(s.kpiKeys);
    }
    // ensure raw and parsedMeta present
    this.store.setState(s);
    // refresh selectors/UI
    this.populateSelectors();
    this.updateKPIFilterUI();
    this.onStateChange(this.store.getState());
    this.updateDashboardActionState();
  }

  showLoader(visible, text) {
    if (!this.loader) return;
    if (typeof text === 'string' && this.loaderText) this.loaderText.textContent = text;
    if (visible) this.loader.classList.add('show'); else this.loader.classList.remove('show');
  }

  showError(message) {
    if (!this.errorMessage) return;
    if (!message) {
      this.errorMessage.classList.add('hidden');
      this.errorMessage.innerHTML = '';
      return;
    }
    // Usar textContent para evitar XSS
    this.errorMessage.innerHTML = '';
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove('hidden');
  }

  populateSelectors() {
    const rows = this.store.getState().raw || [];
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    
    // Escapar headers para evitar XSS si contienen caracteres especiales
    const escapedHeaders = headers.map(h => ({
      original: h,
      escaped: this.escapeHtml(h)
    }));
    
    // Limpiar y repoblar selects
    this.xAxisSelect.innerHTML = '';
    this.valueSelect.innerHTML = '';
    
    escapedHeaders.forEach(h => {
      const opt1 = document.createElement('option');
      opt1.value = h.original;
      opt1.textContent = h.escaped;
      this.xAxisSelect.appendChild(opt1);
      
      const opt2 = document.createElement('option');
      opt2.value = h.original;
      opt2.textContent = h.escaped;
      this.valueSelect.appendChild(opt2);
    });
    
    // Restaurar valores previos si existen
    if (this.store.getState().xAxis) {
      this.xAxisSelect.value = this.store.getState().xAxis;
    }
    if (this.store.getState().valueKey) {
      this.valueSelect.value = this.store.getState().valueKey;
    }
    
    // Populate segmentFieldSelect
    if (this.segmentFieldSelect) {
      this.segmentFieldSelect.innerHTML = '';
      const optNone = document.createElement('option');
      optNone.value = '';
      optNone.textContent = '(ninguno)';
      this.segmentFieldSelect.appendChild(optNone);
      
      escapedHeaders.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.original;
        opt.textContent = h.escaped;
        this.segmentFieldSelect.appendChild(opt);
      });
    }
    
    // Reset segment values
    if (this.segmentValueSelect) {
      this.segmentValueSelect.innerHTML = '';
      const optAll = document.createElement('option');
      optAll.value = 'ALL';
      optAll.textContent = 'Todos';
      this.segmentValueSelect.appendChild(optAll);
    }
  }

  onStateChange(state) {
    // When raw changes or controls change, re-render chart and KPIs
    if (!state.raw || state.raw.length === 0) return;
    if (!state.xAxis || !state.valueKey) return;
    // optionally filter by segment
    let rows = state.raw;
    if (state.segmentField && state.segmentField !== '') {
      if (state.segmentValue && state.segmentValue !== 'ALL') {
        rows = rows.filter(r => String(r[state.segmentField]) === state.segmentValue);
      }
    }
    const { labels, data, total } = this.dataService.aggregate(rows, state.xAxis, state.valueKey);
    // compute metrics on the filtered rows (respect segmentation)
    const metrics = this.computeMetrics(rows, state.valueKey);
    this.renderKPICards(metrics, state.valueKey, state.showCards, state.valueFormat);
    // Determine palette and palette map
    const paletteName = document.getElementById('paletteSelect') ? document.getElementById('paletteSelect').value : 'default';
    const paletteMap = this.chartService && this.chartService.constructor && this.chartService.constructor.paletteMapForLabels
      ? this.chartService.constructor.paletteMapForLabels(labels, paletteName)
      : {};
    this.chartService.createOrUpdate(state.chartType || 'bar', labels, data, state.valueKey, paletteMap, { format: state.valueFormat, total: total });
    this.renderDebug(state.raw);
  }

  // populate unique values for a segment field
  populateSegmentValues(field) {
    if (!this.segmentValueSelect) return;
    const rows = this.store.getState().raw || [];
    const set = new Set();
    rows.forEach(r => { set.add(r[field] === null || r[field] === undefined ? '' : String(r[field])); });
    const arr = Array.from(set).slice(0, 500); // cap for performance
      const html = ['<option value="ALL">Todos</option>'].concat(arr.map(v => {
        const optionValue = v.replace(/"/g, '&quot;'); // Escape double quotes for safety
        return `<option value="${optionValue}">${optionValue}</option>`;
      })).join('');
    this.segmentValueSelect.innerHTML = html;
  }

  computeMetrics(rows, valueKey) {
    const nums = [];
    const unique = new Set();
    let total = 0, count = 0, min = Infinity, max = -Infinity;
    let nullCount = 0, posSum = 0, negSum = 0;
    for (const r of rows) {
      const v = (r[valueKey] === null || r[valueKey] === undefined) ? null : r[valueKey];
      const n = parseFlexible(v);
      if (!Number.isFinite(n)) { nullCount++; continue; }
      nums.push(n);
      unique.add(n);
      total += n; count += 1;
      if (n < min) min = n;
      if (n > max) max = n;
      if (n > 0) posSum += n; if (n < 0) negSum += n;
    }
    const average = count > 0 ? total / count : 0;
    // median
    let median = null;
    if (nums.length > 0) {
      nums.sort((a, b) => a - b);
      const mid = Math.floor(nums.length / 2);
      median = (nums.length % 2 === 1) ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    }
    // standard deviation (population)
    let std = null;
    if (nums.length > 0) {
      const mean = average;
      const variance = nums.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / nums.length;
      std = Math.sqrt(variance);
    }
    // percentiles (nearest-rank)
    let p90 = null, p95 = null;
    if (nums.length > 0) {
      const pRank = (p) => {
        const idx = Math.ceil((p / 100) * nums.length) - 1;
        return nums[Math.max(0, Math.min(nums.length - 1, idx))];
      };
      p90 = pRank(90);
      p95 = pRank(95);
    }
    // MAD (median absolute deviation)
    let mad = null;
    if (nums.length > 0) {
      const diffs = nums.map(x => Math.abs(x - median)).sort((a, b) => a - b);
      const mid = Math.floor(diffs.length / 2);
      mad = (diffs.length % 2 === 1) ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
    }
    return { total, average, count, min: (min === Infinity ? null : min), max: (max === -Infinity ? null : max), median, std, uniqueCount: unique.size, p90, p95, mad, nullCount, posSum, negSum };
  }

  // Helper para escapar HTML y prevenir XSS
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  renderKPICards(metrics, label, show, format) {
    if (!show) { this.kpiContainer.innerHTML = ''; return; }
    const active = Array.from(this.selectedKPIs);
    const cards = [];
    const fmt = function(v) {
      if (v == null) return '-';
      if (format === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CLP' }).format(v);
      if (format === 'percent') {
        if (metrics && metrics.total) return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(v / metrics.total);
        return new Intl.NumberFormat().format(v);
      }
      if (format === 'date') { try { return new Date(v).toLocaleString(); } catch(e){ return String(v); } }
      // default/number/auto
      return new Intl.NumberFormat().format(v);
    };

    if (active.includes('total')) cards.push({ title: `Total ${label}`, value: fmt(metrics.total) });
    if (active.includes('average')) cards.push({ title: `Promedio ${label}`, value: fmt(metrics.average) });
    if (active.includes('count')) cards.push({ title: `Conteo`, value: `${metrics.count}` });
    if (active.includes('min')) cards.push({ title: `Mínimo ${label}`, value: metrics.min == null ? '-' : fmt(metrics.min) });
    if (active.includes('max')) cards.push({ title: `Máximo ${label}`, value: metrics.max == null ? '-' : fmt(metrics.max) });
    if (active.includes('median')) cards.push({ title: `Mediana ${label}`, value: metrics.median == null ? '-' : fmt(metrics.median) });
    if (active.includes('std')) cards.push({ title: `Desviación ${label}`, value: metrics.std == null ? '-' : fmt(metrics.std) });
    if (active.includes('unique')) cards.push({ title: `Únicos ${label}`, value: `${metrics.uniqueCount}` });
    if (active.includes('p90')) cards.push({ title: `P90 ${label}`, value: metrics.p90 == null ? '-' : fmt(metrics.p90) });
    if (active.includes('p95')) cards.push({ title: `P95 ${label}`, value: metrics.p95 == null ? '-' : fmt(metrics.p95) });
    if (active.includes('mad')) cards.push({ title: `MAD ${label}`, value: metrics.mad == null ? '-' : fmt(metrics.mad) });
    if (active.includes('nulls')) cards.push({ title: `Nulos ${label}`, value: `${metrics.nullCount}` });
    if (active.includes('posSum')) cards.push({ title: `Suma Positivos ${label}`, value: metrics.posSum == null ? '-' : fmt(metrics.posSum) });
    if (active.includes('negSum')) cards.push({ title: `Suma Negativos ${label}`, value: metrics.negSum == null ? '-' : fmt(metrics.negSum) });

    if (cards.length === 0) {
      // Usar textContent para evitar XSS
      this.kpiContainer.innerHTML = '';
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'text-sm text-gray-300';
      emptyMsg.textContent = 'Selecciona al menos un KPI para ver tarjetas.';
      this.kpiContainer.appendChild(emptyMsg);
      return;
    }
    
    // Renderizar tarjetas de forma segura (sin innerHTML con datos dinámicos)
    this.kpiContainer.innerHTML = '';
    cards.forEach(c => {
      const card = document.createElement('div');
      card.className = 'glass-panel p-4 rounded-xl border border-blue-500 kpi-card';
      
      const title = document.createElement('p');
      title.className = 'text-xs text-gray-400';
      title.textContent = c.title; // textContent es seguro - no interpreta HTML
      card.appendChild(title);
      
      const value = document.createElement('h3');
      value.className = 'text-2xl font-bold text-white';
      value.textContent = c.value;
      card.appendChild(value);
      
      this.kpiContainer.appendChild(card);
    });
  }

  renderDebug(rows) {
    if (!this.debugInfo || !this.debugSample) return;
    this.debugInfo.textContent = `Filas: ${rows.length}`;
    // show parsed sheet info if available
    const meta = this.store.getState().parsedMeta;
    if (meta && meta.sheetName) {
      this.debugInfo.textContent += ` — Hoja: ${meta.sheetName} — Filas leídas: ${meta.rowCount}`;
    }
    try {
      this.debugSample.textContent = JSON.stringify(rows.slice(0, 10), null, 2);
    } catch (e) {
      this.debugSample.textContent = 'Error mostrando muestra';
    }
  }

  renderKPI(total, label, show) {
    // update KPI without destroying whole container when possible
    if (!show) {
      this.kpiContainer.innerHTML = '';
      return;
    }
    const existing = this.kpiContainer.querySelector('.kpi-card');
    const html = `
      <div class="kpi-card glass-panel p-4 rounded-xl border border-blue-500">
        <p class="text-xs text-gray-400">Total ${label}</p>
        <h3 class="text-2xl font-bold text-white">$${Number(total).toLocaleString()}</h3>
      </div>`;
    if (existing) {
      existing.outerHTML = html;
    } else {
      this.kpiContainer.innerHTML = html;
    }
  }

  toggleKPI(value, enabled) {
    if (!value) return;
    if (enabled) {
      this.selectedKPIs.add(value);
    } else {
      this.selectedKPIs.delete(value);
    }
    this.updateKPIFilterUI();
    this.store.setState({ kpiKeys: Array.from(this.selectedKPIs) });
    this.onStateChange(this.store.getState());
  }

  // Descargar dashboard como PDF
  downloadDashboardPDF() {
    const state = this.store.getState();
    const dashboardName = this.dashboardSelect && this.dashboardSelect.value 
      ? this.dashboards.find(d => d.id === this.dashboardSelect.value)?.name || 'Dashboard'
      : 'Dashboard';
    
    try {
      // Crear contenedor temporal para el PDF
      const pdfContent = document.createElement('div');
      pdfContent.style.padding = '20px';
      pdfContent.style.backgroundColor = '#0f172a';
      pdfContent.style.color = '#e2e8f0';
      pdfContent.style.fontFamily = 'Arial, sans-serif';
      
      // Encabezado
      const header = document.createElement('div');
      header.style.marginBottom = '20px';
      header.style.borderBottom = '2px solid #3b82f6';
      header.style.paddingBottom = '10px';
      
      const title = document.createElement('h1');
      title.textContent = dashboardName;
      title.style.fontSize = '24px';
      title.style.fontWeight = 'bold';
      title.style.margin = '0 0 10px 0';
      header.appendChild(title);
      
      const date = document.createElement('p');
      date.textContent = `Generado: ${new Date().toLocaleString('es-CL')}`;
      date.style.fontSize = '12px';
      date.style.color = '#94a3b8';
      date.style.margin = '0';
      header.appendChild(date);
      
      pdfContent.appendChild(header);
      
      // KPI Cards
      const kpiCards = document.getElementById('kpiContainer');
      if (kpiCards && kpiCards.children.length > 0) {
        const kpiTitle = document.createElement('h2');
        kpiTitle.textContent = 'KPIs';
        kpiTitle.style.fontSize = '18px';
        kpiTitle.style.fontWeight = 'bold';
        kpiTitle.style.marginTop = '20px';
        kpiTitle.style.marginBottom = '10px';
        pdfContent.appendChild(kpiTitle);
        
        const kpiClone = kpiCards.cloneNode(true);
        kpiClone.style.display = 'grid';
        kpiClone.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
        kpiClone.style.gap = '10px';
        kpiClone.style.marginBottom = '20px';
        
        // Limpiar estilos para mejor visualización en PDF
        Array.from(kpiClone.querySelectorAll('.kpi-card')).forEach(card => {
          card.style.border = '1px solid #3b82f6';
          card.style.borderRadius = '8px';
          card.style.padding = '15px';
          card.style.backgroundColor = 'rgba(30,41,59,0.8)';
        });
        
        pdfContent.appendChild(kpiClone);
      }
      
      // Gráfico
      const chartCanvas = document.getElementById('mainChart');
      if (chartCanvas) {
        const chartTitle = document.createElement('h2');
        chartTitle.textContent = 'Gráfico';
        chartTitle.style.fontSize = '18px';
        chartTitle.style.fontWeight = 'bold';
        chartTitle.style.marginTop = '20px';
        chartTitle.style.marginBottom = '10px';
        pdfContent.appendChild(chartTitle);
        
        // Convertir canvas a imagen
        const chartImage = document.createElement('img');
        chartImage.src = chartCanvas.toDataURL('image/png');
        chartImage.style.maxWidth = '100%';
        chartImage.style.height = 'auto';
        chartImage.style.border = '1px solid #3b82f6';
        chartImage.style.borderRadius = '8px';
        chartImage.style.marginTop = '10px';
        pdfContent.appendChild(chartImage);
      }
      
      // Información de datos
      if (state.raw && state.raw.length > 0) {
        const infoTitle = document.createElement('h2');
        infoTitle.textContent = 'Información de Datos';
        infoTitle.style.fontSize = '18px';
        infoTitle.style.fontWeight = 'bold';
        infoTitle.style.marginTop = '20px';
        infoTitle.style.marginBottom = '10px';
        pdfContent.appendChild(infoTitle);
        
        const info = document.createElement('div');
        info.style.fontSize = '12px';
        info.style.color = '#94a3b8';
        info.style.lineHeight = '1.6';
        
        const lines = [
          `Total de filas: ${state.raw.length}`,
          `Columna X: ${state.xAxis || 'N/A'}`,
          `Métrica: ${state.valueKey || 'N/A'}`,
          `Tipo de gráfico: ${state.chartType || 'N/A'}`,
          `Formato: ${state.valueFormat || 'automático'}`
        ];
        
        lines.forEach(line => {
          const p = document.createElement('p');
          p.textContent = line;
          p.style.margin = '5px 0';
          info.appendChild(p);
        });
        
        pdfContent.appendChild(info);
      }
      
      // Opciones de html2pdf
      const options = {
        margin: 10,
        filename: `${dashboardName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'png', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#0f172a' },
        jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' }
      };
      
      // Generar PDF
      if (window.html2pdf) {
        window.html2pdf().set(options).from(pdfContent).save();
        this.showError(null); // Limpiar errores si hay
      } else {
        throw new Error('Librería html2pdf no disponible');
      }
    } catch (err) {
      console.error('Error descargando PDF:', err);
      this.showError(`Error al descargar PDF: ${err.message}`);
    }
  }

  updateKPIFilterUI() {
    if (this.kpiFilterSelect) {
      const options = ['<option value="">Agregar KPI...</option>']
        .concat(this.kpiOptions
          .filter(opt => !this.selectedKPIs.has(opt.value))
          .map(opt => `<option value="${opt.value}">${opt.label}</option>`));
      this.kpiFilterSelect.innerHTML = options.join('');
    }

    if (this.kpiFilterChips) {
      const chips = Array.from(this.selectedKPIs).map(value => {
        const option = this.kpiOptions.find(opt => opt.value === value);
        const label = option ? option.label : value;
        return `<button type="button" data-kpi="${value}" class="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-700 px-3 py-1 text-sm text-white transition hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400">${label}<span class="text-slate-400">×</span></button>`;
      });
      this.kpiFilterChips.innerHTML = chips.join('') || '<span class="text-sm text-slate-500">Sin KPIs seleccionados</span>';
    }
  }
}
