/* Standalone app script (no ES modules) for file:// usage
   Combines parseFlexible, Store, DataService, ChartService, UIController and init
   Relies on global `XLSX` and `Chart` loaded from CDN in index.html
*/
(function(){
  console.info('[app-standalone] loaded');

  // parseFlexible (from utils)
  function parseFlexible(value) {
    if (value == null || value === '') return null;
    let str = String(value).trim();
    str = str.replace(/[^0-9,\.\-]/g, '');
    const commaCount = (str.match(/,/g) || []).length;
    const dotCount = (str.match(/\./g) || []).length;
    if (commaCount > 0 && dotCount === 0) {
      str = str.replace(/\./g, '');
      str = str.replace(/,/g, '.');
    } else if (dotCount > 0 && commaCount === 0) {
      str = str.replace(/,/g, '');
    } else if (dotCount > 0 && commaCount > 0) {
      if (str.lastIndexOf('.') > str.lastIndexOf(',')) {
        str = str.replace(/,/g, '');
      } else {
        str = str.replace(/\./g, '');
        str = str.replace(/,/g, '.');
      }
    }
    const n = parseFloat(str);
    return Number.isFinite(n) ? n : null;
  }

  // Store
  function Store(initial) {
    this.state = Object.assign({ raw: [], xAxis: null, valueKey: null, chartType: 'bar', showCards: true }, initial || {});
    this.subscribers = new Set();
  }
  Store.prototype.setState = function(patch) {
    Object.assign(this.state, patch);
    var snapshot = Object.assign({}, this.state);
    this.subscribers.forEach(function(fn){ try { fn(snapshot); } catch(e){ console.error('Subscriber error', e); } });
  };
  Store.prototype.getState = function(){ return this.state; };
  Store.prototype.subscribe = function(fn){ this.subscribers.add(fn); return function(){ this.subscribers.delete(fn); }.bind(this); };

  // DataService
  function DataService(store) { this.store = store; }
  DataService.prototype.loadFile = function(file) {
    var WORKER_THRESHOLD = 2 * 1024 * 1024;
    var self = this;
    return new Promise(function(resolve, reject){
      if (!file) return reject(new Error('No file provided'));
      console.debug('[DataService] loadFile start', file && file.name);
      if (file.size > WORKER_THRESHOLD && typeof Worker !== 'undefined') {
        var reader = new FileReader();
        reader.onerror = function(){ reject(new Error('FileReader error')); };
        reader.onload = function(e){
          try {
            var buffer = e.target.result;
            var workerLines = [
              "importScripts('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js');",
              "self.onmessage = function(e) {",
              "  var msg = e.data;",
              "  if (!msg || !msg.type) return;",
              "  if (msg.type === 'process') {",
              "    try {",
              "      var buffer = msg.buffer;",
              "      var workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });",
              "      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {",
              "        self.postMessage({ type: 'error', message: 'Workbook has no sheets' });",
              "        return;",
              "      }",
              "      var sheet = workbook.Sheets[workbook.SheetNames[0]];",
              "      var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });",
                "      self.postMessage({ type: 'result', sheetName: workbook.SheetNames[0], json: json });",
              "    } catch (err) {",
              "      self.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });",
              "    }",
              "  }",
              "};"
            ];
            var workerCode = workerLines.join('\n');
            var blob = new Blob([workerCode], { type: 'application/javascript' });
            var workerUrl = URL.createObjectURL(blob);
            var worker = new Worker(workerUrl);
            var timeout = setTimeout(function(){ worker.terminate(); reject(new Error('Worker timeout while processing file')); }, 30*1000);
            worker.onmessage = function(ev){ var msg = ev.data; if (msg.type === 'result') { clearTimeout(timeout); var json = msg.json || []; var sheetName = msg.sheetName || (msg.sheetNames && msg.sheetNames[0]) || 'Sheet1'; var cleaned = json.map(function(row){ var out = {}; Object.keys(row).forEach(function(k){ out[k] = (row[k] === null || row[k] === undefined) ? '' : row[k]; }); return out; }); if (!cleaned || cleaned.length === 0) { self.store.setState({ raw: [], parsedMeta: { sheetName: sheetName, rowCount: 0 } }); worker.terminate(); return reject(new Error('No rows found in sheet')); } self.store.setState({ raw: cleaned, parsedMeta: { sheetName: sheetName, rowCount: cleaned.length } }); worker.terminate(); resolve(cleaned); } else if (msg.type === 'error') { clearTimeout(timeout); worker.terminate(); reject(new Error(msg.message || 'Worker error')); } };
            try { worker.postMessage({ type: 'process', buffer }, [buffer]); } catch(err) { worker.postMessage({ type: 'process', buffer }); }
            URL.revokeObjectURL(workerUrl);
          } catch(err){ reject(err); }
        };
        reader.readAsArrayBuffer(file);
        return;
      }
      // fallback main thread
      var reader2 = new FileReader();
      reader2.onerror = function(){ reject(new Error('FileReader error')); };
      reader2.onload = function(e){
        try {
          var workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) return reject(new Error('Workbook has no sheets'));
          var sheetName = workbook.SheetNames[0];
          console.debug('[DataService] workbook sheets:', workbook.SheetNames);
          var sheet = workbook.Sheets[sheetName];
          var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          var cleaned2 = json.map(function(row){ var out = {}; Object.keys(row).forEach(function(k){ out[k] = (row[k] === null || row[k] === undefined) ? '' : row[k]; }); return out; });
          if (!cleaned2 || cleaned2.length === 0) { self.store.setState({ raw: [], parsedMeta: { sheetName: sheetName, rowCount: 0 } }); return reject(new Error('No rows found in sheet')); }
          self.store.setState({ raw: cleaned2, parsedMeta: { sheetName: sheetName, rowCount: cleaned2.length } }); resolve(cleaned2);
        } catch(err){ reject(err); }
      };
      reader2.readAsArrayBuffer(file);
    });
  };
  DataService.prototype.aggregate = function(rows, xKey, valueKey) {
    var grouped = new Map(); var total = 0;
    rows.forEach(function(row){ var x = (row[xKey] === null || row[xKey] === undefined || row[xKey] === '') ? 'N/A' : String(row[xKey]); var v = parseFlexible(row[valueKey]) || 0; grouped.set(x, (grouped.get(x) || 0) + v); total += v; });
    return { labels: Array.from(grouped.keys()), data: Array.from(grouped.values()), total };
  };

  // ChartService
  function ChartService(canvasId) { this.canvas = document.getElementById(canvasId); if(!this.canvas) throw new Error('Canvas not found: ' + canvasId); this.ctx = this.canvas.getContext('2d'); this.chart = null; }
  ChartService.prototype.createOrUpdate = function(type, labels, data, label, paletteMap, formatOptions) {
    var background;
    if (Array.isArray(data)) {
      background = labels.map(function(l){ return (paletteMap && paletteMap[l]) || '#3b82f6'; });
    } else {
      background = (paletteMap && paletteMap[label]) || '#3b82f6';
    }
    var dataset = { label: label || '', data: data, backgroundColor: background, borderColor: '#60a5fa', borderWidth: 1 };
    var options = { responsive: true, maintainAspectRatio: false };
    if (formatOptions && formatOptions.format) {
      var fmt = formatOptions.format;
      var total = formatOptions.total || null;
      options.plugins = options.plugins || {};
      options.plugins.tooltip = {
        callbacks: {
          label: function(context) {
            var v = null;
            if (context.parsed && typeof context.parsed === 'object') {
              v = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
            } else {
              v = context.raw !== undefined ? context.raw : context.parsed;
            }
            if (v == null) return '';
            if (fmt === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v);
            if (fmt === 'percent' && total) return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(v/total);
            if (fmt === 'number') return new Intl.NumberFormat().format(v);
            if (fmt === 'date') { try { return new Date(v).toLocaleString(); } catch(e){ return String(v); } }
            return String(v);
          }
        }
      };
    }
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.chart = new Chart(this.ctx, { type: type, data: { labels: labels, datasets: [dataset] }, options: options });
  };
  ChartService.prototype.destroy = function(){ if(this.chart){ this.chart.destroy(); this.chart = null; } };

  // UIController
  function UIController(store, dataService, chartService) {
    this.store = store; this.dataService = dataService; this.chartService = chartService;
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
    this.store.subscribe(this.onStateChange.bind(this));
    // load dashboards
    this.loadDashboards();
  }
  UIController.prototype.bindEvents = function(){ var self = this; if(this.fileInput){ this.fileInput.addEventListener('change', function(e){ var file = e.target.files && e.target.files[0]; if(!file) return; (async function(){ try{ console.debug('[UI] file selected', file.name); self.showError(null); self.showLoader(true,'Procesando archivo...'); var cleaned = await self.dataService.loadFile(file); console.debug('[UI] loadFile resolved, rows:', cleaned && cleaned.length); self.populateSelectors(); self.controls.classList.remove('hidden'); var headers = Object.keys(self.store.getState().raw[0] || {}); self.store.setState({ xAxis: headers[0] || null, valueKey: headers[1] || null }); self.showLoader(false); } catch(err){ console.error('Error loading file', err); self.showLoader(false); self.showError(err && err.message ? err.message : String(err)); } })(); }); }
    var onControlChange = function(){ self.store.setState({ xAxis: self.xAxisSelect.value, valueKey: self.valueSelect.value, valueFormat: self.valueFormatSelect ? self.valueFormatSelect.value : 'auto', segmentField: self.segmentFieldSelect ? self.segmentFieldSelect.value : null, segmentValue: self.segmentValueSelect ? self.segmentValueSelect.value : null, chartType: self.chartTypeSelect.value, showCards: self.showCardsCheckbox.checked }); };
    var listenEls = [this.xAxisSelect, this.valueSelect, this.chartTypeSelect, this.showCardsCheckbox, this.segmentValueSelect, this.valueFormatSelect];
    listenEls.forEach(function(el){ if(!el) return; el.addEventListener('change', onControlChange); });
    if (this.segmentFieldSelect) {
      this.segmentFieldSelect.addEventListener('change', function(e){ var f = e.target.value; if(f) self.populateSegmentValues(f); onControlChange(); });
    }
    if (this.kpiFilterSelect) {
      this.kpiFilterSelect.addEventListener('change', function(){ var value = self.kpiFilterSelect.value; if(value){ self.toggleKPI(value, true); self.kpiFilterSelect.value = ''; } });
    }
    if (this.addKPIBtn) {
      this.addKPIBtn.addEventListener('click', function(){ var value = self.kpiFilterSelect ? self.kpiFilterSelect.value : null; if(value){ self.toggleKPI(value, true); self.kpiFilterSelect.value = ''; } });
    }
    if (this.kpiFilterChips) {
      this.kpiFilterChips.addEventListener('click', function(e){ var chip = e.target.closest('[data-kpi]'); if(!chip) return; var kpi = chip.getAttribute('data-kpi'); if(kpi) self.toggleKPI(kpi, false); });
    }
    // dashboard controls
    if (this.newDashboardBtn) this.newDashboardBtn.addEventListener('click', function(){ self.createNewDashboard(); });
    if (this.saveDashboardBtn) this.saveDashboardBtn.addEventListener('click', function(){ self.saveCurrentDashboard(); });
    if (this.deleteDashboardBtn) this.deleteDashboardBtn.addEventListener('click', function(){ self.deleteCurrentDashboard(); });
    if (this.dashboardSelect) this.dashboardSelect.addEventListener('change', function(e){ self.switchToDashboard(e.target.value); });
  };
  UIController.prototype.showLoader = function(visible, text){ if(!this.loader) return; if(typeof text === 'string' && this.loaderText) this.loaderText.textContent = text; if(visible) this.loader.classList.add('show'); else this.loader.classList.remove('show'); };
  UIController.prototype.showError = function(message){ if(!this.errorMessage) return; if(!message){ this.errorMessage.classList.add('hidden'); this.errorMessage.textContent = ''; return; } this.errorMessage.textContent = message; this.errorMessage.classList.remove('hidden'); };
  UIController.prototype.populateSelectors = function(){ var rows = this.store.getState().raw || []; if(rows.length === 0) return; var headers = Object.keys(rows[0]); var html = headers.map(function(h){ return '<option value="'+h+'">'+h+'</option>'; }).join(''); this.xAxisSelect.innerHTML = html; this.valueSelect.innerHTML = html; };
  UIController.prototype.populateSelectors = function(){ var rows = this.store.getState().raw || []; if(rows.length === 0) return; var headers = Object.keys(rows[0]); var html = headers.map(function(h){ return '<option value="'+h+'">'+h+'</option>'; }).join(''); this.xAxisSelect.innerHTML = html; this.valueSelect.innerHTML = html; if(this.segmentFieldSelect){ this.segmentFieldSelect.innerHTML = '<option value="">(ninguno)</option>' + html; } if(this.segmentValueSelect){ this.segmentValueSelect.innerHTML = '<option value="ALL">Todos</option>'; } };
  UIController.prototype.onStateChange = function(state){ if(!state.raw || state.raw.length === 0) return; if(!state.xAxis || !state.valueKey) return; var rows = state.raw; if(state.segmentField && state.segmentField !== ''){ if(state.segmentValue && state.segmentValue !== 'ALL'){ rows = rows.filter(function(r){ return String(r[state.segmentField]) === state.segmentValue; }); } } var agg = this.dataService.aggregate(rows, state.xAxis, state.valueKey); var metrics = this.computeMetrics(rows, state.valueKey); this.renderKPICards(metrics, state.valueKey, state.showCards, state.valueFormat); // handle palette
    var paletteName = document.getElementById('paletteSelect') ? document.getElementById('paletteSelect').value : 'default';
    var paletteMap = (this.chartService && this.chartService.constructor && this.chartService.constructor.paletteMapForLabels) ? this.chartService.constructor.paletteMapForLabels(agg.labels, paletteName) : {};
    this.chartService.createOrUpdate(state.chartType || 'bar', agg.labels, agg.data, state.valueKey, paletteMap, { format: state.valueFormat, total: agg.total });
    this.renderDebug(state.raw); };
  UIController.prototype.computeMetrics = function(rows, valueKey){
    var nums = [];
    var unique = new Set();
    var total=0,count=0,min=Infinity,max=-Infinity;
    var nullCount = 0, posSum = 0, negSum = 0;
    for(var i=0;i<rows.length;i++){
      var r=rows[i];
      var v=(r[valueKey]===null||r[valueKey]===undefined)?null:r[valueKey];
      var n=parseFlexible(v);
      if(!Number.isFinite(n)){ nullCount++; continue; }
      nums.push(n); unique.add(n); total+=n; count+=1; if(n<min) min=n; if(n>max) max=n; if(n>0) posSum+=n; if(n<0) negSum+=n;
    }
    var average = count>0? total/count : 0;
    var median = null;
    if(nums.length>0){ nums.sort(function(a,b){return a-b;}); var mid = Math.floor(nums.length/2); median = (nums.length%2===1)? nums[mid] : (nums[mid-1]+nums[mid])/2; }
    var std = null; if(nums.length>0){ var mean = average; var variance = nums.reduce(function(s,x){ return s + Math.pow(x-mean,2); },0)/nums.length; std = Math.sqrt(variance); }
    var p90 = null, p95 = null; if(nums.length>0){ var pRank = function(p){ var idx = Math.ceil((p/100)*nums.length)-1; return nums[Math.max(0, Math.min(nums.length-1, idx))]; }; p90 = pRank(90); p95 = pRank(95); }
    var mad = null; if(nums.length>0){ var diffs = nums.map(function(x){ return Math.abs(x-median); }).sort(function(a,b){return a-b;}); var m = Math.floor(diffs.length/2); mad = (diffs.length%2===1)? diffs[m] : (diffs[m-1]+diffs[m])/2; }
    return { total: total, average: average, count: count, min: (min===Infinity?null:min), max: (max===-Infinity?null:max), median: median, std: std, uniqueCount: unique.size, p90: p90, p95: p95, mad: mad, nullCount: nullCount, posSum: posSum, negSum: negSum };
  };
  
  UIController.prototype.renderKPICards = function(metrics, label, show, format){
    if(!show){ this.kpiContainer.innerHTML=''; return; }
    var active = Array.from(this.selectedKPIs);
    var cards = [];
    var fmt = function(v){ if(v==null) return '-'; if(format === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v); if(format === 'percent'){ if(metrics && metrics.total) return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(v/metrics.total); return new Intl.NumberFormat().format(v); } if(format === 'date'){ try{ return new Date(v).toLocaleString(); }catch(e){ return String(v);} } return new Intl.NumberFormat().format(v); };
    if(active.indexOf('total')!==-1) cards.push({ title: 'Total '+label, value: fmt(metrics.total) });
    if(active.indexOf('average')!==-1) cards.push({ title: 'Promedio '+label, value: fmt(metrics.average) });
    if(active.indexOf('count')!==-1) cards.push({ title: 'Conteo', value: ''+metrics.count });
    if(active.indexOf('min')!==-1) cards.push({ title: 'Mínimo '+label, value: metrics.min==null?'-':fmt(metrics.min) });
    if(active.indexOf('max')!==-1) cards.push({ title: 'Máximo '+label, value: metrics.max==null?'-':fmt(metrics.max) });
    if(active.indexOf('median')!==-1) cards.push({ title: 'Mediana '+label, value: metrics.median==null?'-':fmt(metrics.median) });
    if(active.indexOf('std')!==-1) cards.push({ title: 'Desviación '+label, value: metrics.std==null?'-':fmt(metrics.std) });
    if(active.indexOf('unique')!==-1) cards.push({ title: 'Únicos '+label, value: ''+metrics.uniqueCount });
    if(active.indexOf('p90')!==-1) cards.push({ title: 'P90 '+label, value: metrics.p90==null?'-':fmt(metrics.p90) });
    if(active.indexOf('p95')!==-1) cards.push({ title: 'P95 '+label, value: metrics.p95==null?'-':fmt(metrics.p95) });
    if(active.indexOf('mad')!==-1) cards.push({ title: 'MAD '+label, value: metrics.mad==null?'-':fmt(metrics.mad) });
    if(active.indexOf('nulls')!==-1) cards.push({ title: 'Nulos '+label, value: ''+metrics.nullCount });
    if(active.indexOf('posSum')!==-1) cards.push({ title: 'Suma Positivos '+label, value: metrics.posSum==null?'-':fmt(metrics.posSum) });
    if(active.indexOf('negSum')!==-1) cards.push({ title: 'Suma Negativos '+label, value: metrics.negSum==null?'-':fmt(metrics.negSum) });
    if(cards.length === 0){ this.kpiContainer.innerHTML = '<div class="text-sm text-gray-300">Selecciona al menos un KPI para ver tarjetas.</div>'; return; }
    this.kpiContainer.innerHTML = cards.map(function(c){ return '<div class="glass-panel p-4 rounded-xl border border-blue-500 kpi-card"><p class="text-xs text-gray-400">'+c.title+'</p><h3 class="text-2xl font-bold text-white">'+c.value+'</h3></div>'; }).join('');
  };
  UIController.prototype.toggleKPI = function(value, enabled){ if(!value) return; if(enabled){ this.selectedKPIs.add(value); } else { this.selectedKPIs.delete(value); } this.updateKPIFilterUI(); this.store.setState({ kpiKeys: Array.from(this.selectedKPIs) }); this.onStateChange(this.store.getState()); };
  UIController.prototype.updateKPIFilterUI = function(){ if(this.kpiFilterSelect){ var options = ['<option value="">Agregar KPI...</option>'].concat(this.kpiOptions.filter(function(opt){ return !this.selectedKPIs.has(opt.value); }.bind(this)).map(function(opt){ return '<option value="'+opt.value+'">'+opt.label+'</option>'; })); this.kpiFilterSelect.innerHTML = options.join(''); }
    if(this.kpiFilterChips){ var chips = Array.from(this.selectedKPIs).map(function(value){ var option = this.kpiOptions.find(function(opt){ return opt.value === value; }.bind(this)); var label = option ? option.label : value; return '<button type="button" data-kpi="'+value+'" class="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-700 px-3 py-1 text-sm text-white transition hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400">'+label+'<span class="text-slate-400">×</span></button>'; }.bind(this)); this.kpiFilterChips.innerHTML = chips.join('') || '<span class="text-sm text-slate-500">Sin KPIs seleccionados</span>'; } };

  UIController.prototype.populateSegmentValues = function(field){
    if(!this.segmentValueSelect) return;
    var rows = this.store.getState().raw || [];
    var set = new Set();
    rows.forEach(function(r){ set.add((r[field]===null||r[field]===undefined) ? '' : String(r[field])); });
    var arr = Array.from(set).slice(0,500);
    // build options using DOM methods to avoid complex inline strings
    this.segmentValueSelect.innerHTML = '';
    var optAll = document.createElement('option'); optAll.value = 'ALL'; optAll.textContent = 'Todos'; this.segmentValueSelect.appendChild(optAll);
    for(var i=0;i<arr.length;i++){ var v = arr[i]; var o = document.createElement('option'); o.value = v; o.textContent = v; this.segmentValueSelect.appendChild(o); }
  };

  // dashboards persistence for standalone
  UIController.prototype.loadDashboards = function(){ try{ var raw = localStorage.getItem('dashboards_v1'); this.dashboards = raw ? JSON.parse(raw) : []; }catch(e){ this.dashboards = []; } this.populateDashboardSelect(); if(this.dashboards.length>0){ this.switchToDashboard(this.dashboards[0].id); } };
  UIController.prototype.persistDashboards = function(){ try{ localStorage.setItem('dashboards_v1', JSON.stringify(this.dashboards)); }catch(e){ console.warn('Could not persist dashboards', e); } };
  UIController.prototype.populateDashboardSelect = function(){ if(!this.dashboardSelect) return; if(this.dashboards.length===0){ this.dashboardSelect.innerHTML = '<option value="">(ninguno)</option>'; this.updateDashboardActionState(); return; } var current = this.dashboardSelect ? this.dashboardSelect.value : null; this.dashboardSelect.innerHTML = this.dashboards.map(function(d){ return '<option value="'+d.id+'">'+d.name+'</option>'; }).join(''); if(current && this.dashboards.some(function(d){ return d.id === current; })){ this.dashboardSelect.value = current; } else { this.dashboardSelect.value = this.dashboards[0].id; } this.updateDashboardActionState(); };
  UIController.prototype.createNewDashboard = function(){ var name = prompt('Nombre del dashboard nuevo:', 'Dashboard '+(this.dashboards.length+1)); if(!name) return; var id = String(Date.now()); var snapshot = { raw: [], xAxis: null, valueKey: null, chartType: 'bar', showCards: true, valueFormat: 'auto', parsedMeta: {}, kpiKeys: Array.from(this.selectedKPIs) }; this.dashboards.unshift({ id: id, name: name, state: snapshot }); this.persistDashboards(); this.populateDashboardSelect(); this.dashboardSelect.value = id; this.switchToDashboard(id); };
  UIController.prototype.updateDashboardActionState = function(){ var hasSelection = this.dashboardSelect && this.dashboardSelect.value; if(this.saveDashboardBtn) this.saveDashboardBtn.disabled = !hasSelection; if(this.deleteDashboardBtn) this.deleteDashboardBtn.disabled = !hasSelection; };
  UIController.prototype.saveCurrentDashboard = function(){ if(!this.dashboardSelect) return; var id = this.dashboardSelect.value; if(!id) return; var idx = this.dashboards.findIndex(function(d){ return d.id === id; }); if(idx === -1) return; this.dashboards[idx].state = Object.assign({}, this.store.getState(), { kpiKeys: Array.from(this.selectedKPIs) }); this.persistDashboards(); alert('Dashboard guardado'); };
  UIController.prototype.deleteCurrentDashboard = function(){ if(!this.dashboardSelect) return; var id = this.dashboardSelect.value; if(!id) return; var idx = this.dashboards.findIndex(function(d){ return d.id === id; }); if(idx === -1) return; if(!confirm('¿Borrar dashboard "'+this.dashboards[idx].name+'"?')) return; this.dashboards.splice(idx,1); this.persistDashboards(); this.populateDashboardSelect(); if(this.dashboards.length>0) this.switchToDashboard(this.dashboards[0].id); };
  UIController.prototype.switchToDashboard = function(id){ var d = (this.dashboards || []).find(function(x){ return x.id === id; }); if(!d) return; var s = Object.assign({}, d.state || {}); if (Array.isArray(s.kpiKeys) && s.kpiKeys.length > 0) { this.selectedKPIs = new Set(s.kpiKeys); } this.store.setState(s); this.populateSelectors(); this.updateKPIFilterUI(); this.onStateChange(this.store.getState()); this.updateDashboardActionState(); };

  // Init
  try {
    var store = new Store();
    var dataService = new DataService(store);
    var chartService = new ChartService('mainChart');
    // expose palette utilities on chartService for standalone
    chartService.constructor.palettes = ChartService.palettes || function(){ return { default: ['#3b82f6'] }; };
    chartService.constructor.paletteMapForLabels = ChartService.paletteMapForLabels || function(labels,name){ var arr = (ChartService.palettes && ChartService.palettes()[name]) || ['#3b82f6']; var map = {}; labels.forEach(function(l,i){ map[l]=arr[i%arr.length]; }); return map; };
    var ui = new UIController(store, dataService, chartService);
    window.__APP__ = window.__APP__ || {};
    window.__APP__.store = store; window.__APP__.dataService = dataService; window.__APP__.chartService = chartService; window.__APP__.ui = ui; window.__APP__.initialized = true;
    console.info('[app-standalone] initialized');
  } catch(err) {
    console.error('[app-standalone] init error', err);
    window.__APP__ = window.__APP__ || {}; window.__APP__.initError = err && err.message ? err.message : String(err);
  }

})();
