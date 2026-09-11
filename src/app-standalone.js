/* Runtime de producción del Dashboard Builder. */
(function () {
  'use strict';

  var Utils = window.DashboardChartUtils;
  if (!Utils) throw new Error('DashboardChartUtils no está disponible.');

  var state = window.dashboardState = Object.assign({ rawData: [], filteredData: [], visuals: [], globalFilters: [], activeVisualId: null, sourceLabel: '' }, window.dashboardState || {});
  var uid = 0;
  var loadGeneration = 0;
  var MAX_FILE_SIZE = 100 * 1024 * 1024;
  var DB_NAME = 'dashboard-builder-client';
  var DB_STORE = 'projects';

  function id() { return 'visual-' + Date.now().toString(36) + '-' + (++uid); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function fieldOf(v) { return typeof v === 'string' ? v : v && (v.name || v.field); }
  function text(v) { return v == null || v === '' ? '(vacío)' : String(v); }
  function number(v) { return Utils.parseLocaleNumber(v); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

  var defaultHeader = { visible: true, showSubtitle: true, showDescription: true, align: 'left', font: 'system', size: 15, color: '#0f172a', bold: true, italic: false, spacing: 2 };
  var defaultChartOptions = { showLegend: true, showLabels: false, showPercentage: false, showValues: false, showValueAndPercentage: false, showTooltip: true, showAnimations: true, automaticColors: true, palette: 'office', decimalPlaces: 0, sortDirection: 'none', topN: 0 };
  var palettes = {
    office: ['#4F46E5','#06B6D4','#22C55E','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#84CC16','#0EA5E9','#D946EF','#F43F5E','#A855F7','#10B981','#6366F1'],
    microsoft: ['#0078D4','#107C10','#FFB900','#D83B01','#5C2D91','#00B7C3','#E81123','#498205','#8764B8','#00BCF2','#C239B3','#CA5010'],
    powerbi: ['#F2C80F','#118DFF','#E66C37','#6B007B','#E044A7','#744EC2','#D9B300','#FE9666','#A66999','#3599B8','#DFBFBF','#4AC5BB'],
    rainbow: ['#6366F1','#0EA5E9','#06B6D4','#10B981','#84CC16','#EAB308','#F97316','#EF4444','#EC4899','#A855F7'],
    pastel: ['#818CF8','#67E8F9','#86EFAC','#FDE68A','#FDA4AF','#C4B5FD','#F9A8D4','#99F6E4','#FDBA74','#BEF264'],
    dark: ['#312E81','#0E7490','#166534','#B45309','#B91C1C','#6D28D9','#9D174D','#0F766E','#C2410C','#3F6212'],
    neon: ['#6366F1','#22D3EE','#4ADE80','#FACC15','#FB7185','#C084FC','#F472B6','#2DD4BF','#FB923C','#A3E635']
  };
  var opNames = { sum:'Suma', average:'Promedio', count:'Conteo', distinct:'Conteo distinto', min:'Mínimo', max:'Máximo', median:'Mediana', mode:'Moda', variance:'Varianza', stddev:'Desviación estándar', percentile:'Percentil' };

  function normalizeMeasure(m) {
    var item = typeof m === 'string' ? { name: m } : (m || {});
    return Object.assign({ name: null, operation: 'sum', percentile: 50, axis: 'auto', seriesType: 'auto', format: 'auto' }, item);
  }

  function normalizeFilter(f) {
    var values = Array.isArray(f && f.values) ? f.values.map(String) : (f && f.value !== '' && f.value != null ? [String(f.value)] : []);
    return { field: fieldOf(f), scope: f && f.scope === 'global' ? 'global' : 'local', values: values, matchNone: !!(f && f.matchNone) };
  }

  function defaultVisual(overrides) {
    return Object.assign({ id: id(), title: 'Nueva visualización', subtitle: '', description: '', type: 'bar', categories: [], values: [], legends: [], filters: [], x: 0, y: 0, w: 6, h: 5, options: clone(defaultChartOptions), header: clone(defaultHeader) }, overrides || {});
  }

  function normalizeVisual(v, index) {
    v = v || {};
    var p = v.position || {}, s = v.size || {}, legacyPalette = v.options && ({ blue:'office', emerald:'powerbi', warm:'rainbow' }[v.options.palette] || v.options.palette);
    var result = defaultVisual(Object.assign({}, v, {
      id: v.id || id(),
      x: Number.isFinite(v.x) ? v.x : Math.max(0, (p.column || 1) - 1),
      y: Number.isFinite(v.y) ? v.y : Math.max(0, (p.row || index + 1) - 1),
      w: Number.isFinite(v.w) ? v.w : (s.width || 6),
      h: Number.isFinite(v.h) ? v.h : Math.max(3, (s.height || 1) * 4),
      header: Object.assign({}, defaultHeader, v.header || {}),
      options: Object.assign({}, defaultChartOptions, v.options || {}, { palette: palettes[legacyPalette] ? legacyPalette : 'office' })
    }));
    result.filters = (v.filters || []).map(normalizeFilter).filter(function (f) { return f.field; });
    result.values = (v.values || []).map(normalizeMeasure).filter(function (m) { return m.name; });
    result.categories = (v.categories || []).map(fieldOf).filter(Boolean);
    result.legends = (v.legends || []).map(fieldOf).filter(Boolean);
    return result;
  }

  state.globalFilters = (state.globalFilters || []).map(normalizeFilter).filter(function (f) { return f.field; });
  state.visuals = Array.isArray(state.visuals) ? state.visuals.map(normalizeVisual) : [];
  if (!state.visuals.length) state.visuals.push(defaultVisual({ title: 'Visualización 1' }));
  if (!state.activeVisualId || !state.visuals.some(function (v) { return v.id === state.activeVisualId; })) state.activeVisualId = state.visuals[0].id;

  function active() { return state.visuals.find(function (v) { return v.id === state.activeVisualId; }) || state.visuals[0]; }
  function syncLegacy() { var v = active(); if (v) { state.chartType = v.type; state.categories = v.categories; state.values = v.values; state.legends = v.legends; state.filters = v.filters; } }

  function showToast(message, type) {
    var toast = document.getElementById('appToast');
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.type = type || 'info';
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.hidden = true; }, 3200);
  }

  function showError(message) {
    var target = document.getElementById('errorMessage');
    if (target) { target.textContent = message; target.hidden = false; }
    showToast(message, 'error');
  }

  function clearError() { var target = document.getElementById('errorMessage'); if (target) { target.textContent = ''; target.hidden = true; } }
  function setBusy(busy, message) { var loader = document.getElementById('loader'), label = document.getElementById('loaderText'); if (loader) loader.classList.toggle('show', !!busy); if (label && message) label.textContent = message; }

  function resetDatasetState(fields, measure) {
    state.filteredData = [];
    state.globalFilters = [];
    state.visuals = [defaultVisual({ title: 'Visualización 1', categories: fields[0] ? [fields[0]] : [], values: measure ? [normalizeMeasure({ name: measure })] : [] })];
    state.activeVisualId = state.visuals[0].id;
    syncLegacy();
  }

  function aggregate(rows, m) {
    m = normalizeMeasure(m);
    var values = rows.map(function (r) { return m.name ? r[m.name] : 1; });
    var nums = values.map(number).filter(Number.isFinite), op = m.operation || 'sum';
    if (op === 'count') return m.name ? values.filter(function (v) { return v != null && v !== ''; }).length : rows.length;
    if (op === 'distinct') return new Set(values.filter(function (v) { return v != null && v !== ''; }).map(String)).size;
    if (!nums.length) return 0;
    var total = nums.reduce(function (a,b) { return a+b; }, 0), sorted = nums.slice().sort(function (a,b) { return a-b; });
    if (op === 'average') return total / nums.length;
    if (op === 'min') return sorted[0];
    if (op === 'max') return sorted[sorted.length - 1];
    if (op === 'median') { var mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; }
    if (op === 'mode') { var counts = new Map(), best = sorted[0], high = 0; nums.forEach(function (n) { var c = (counts.get(n) || 0) + 1; counts.set(n, c); if (c > high) { high = c; best = n; } }); return best; }
    if (op === 'variance' || op === 'stddev') { var avg = total / nums.length, variance = nums.reduce(function (a,n) { return a + Math.pow(n - avg, 2); }, 0) / nums.length; return op === 'stddev' ? Math.sqrt(variance) : variance; }
    if (op === 'percentile') { var at = (sorted.length - 1) * Math.max(0, Math.min(100, Number(m.percentile) || 50)) / 100, lo = Math.floor(at), hi = Math.ceil(at); return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo); }
    return total;
  }

  function matches(row, filters) {
    return filters.every(function (f) {
      if (f.matchNone) return false;
      if (!f.values || !f.values.length) return true;
      return f.values.some(function (v) { return String(row[f.field] == null ? '' : row[f.field]).trim() === String(v).trim(); });
    });
  }

  function globalRows() {
    return state.rawData.filter(function (row) { return matches(row, state.globalFilters || []); });
  }

  function applyOrdering(visual, labels, datasets) {
    var order = (visual.options && visual.options.sortDirection) || 'none';
    var topN = Math.max(0, Number(visual.options && visual.options.topN) || 0);
    var indices = labels.map(function (_, i) { return i; });
    if (order !== 'none' && datasets[0]) {
      indices.sort(function (a, b) {
        var av = Number(datasets[0].data[a]) || 0, bv = Number(datasets[0].data[b]) || 0;
        return order === 'asc' ? av - bv : bv - av;
      });
    }
    if (topN > 0) indices = indices.slice(0, topN);
    return {
      labels: indices.map(function (i) { return labels[i]; }),
      datasets: datasets.map(function (dataset) { var copy = Object.assign({}, dataset); copy.data = indices.map(function (i) { return dataset.data[i]; }); return copy; })
    };
  }

  function execute(visual) {
    visual = normalizeVisual(visual, 0);
    var local = (visual.filters || []).map(normalizeFilter).filter(function (f) { return f.scope !== 'global'; });
    var all = (state.globalFilters || []).concat(local);
    var rows = state.rawData.filter(function (row) { return matches(row, all); });
    var cats = (visual.categories || []).map(fieldOf).filter(Boolean), legs = (visual.legends || []).map(fieldOf).filter(Boolean);
    var measures = (visual.values || []).map(normalizeMeasure).filter(function (m) { return m.name; });
    if (!measures.length) measures = [normalizeMeasure({ name: null, operation: 'count' })];
    var groups = new Map(), catMap = new Map(), legMap = new Map();

    rows.forEach(function (row) {
      var cp = cats.map(function (f) { return text(row[f]); }), lp = legs.map(function (f) { return text(row[f]); });
      var ck = JSON.stringify(cp), lk = JSON.stringify(lp), key = ck + '\u0000' + lk;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row); catMap.set(ck, cp); legMap.set(lk, lp);
    });
    if (!groups.size && !cats.length && !legs.length) { groups.set('[]\u0000[]', rows); catMap.set('[]', []); legMap.set('[]', []); }

    var ckeys = Array.from(catMap.keys()), lkeys = Array.from(legMap.keys());
    var labels = ckeys.map(function (k) { var arr = catMap.get(k); return arr.length ? arr.join(' · ') : 'Total'; });
    var datasets = [];
    lkeys.forEach(function (lk) {
      measures.forEach(function (m) {
        var prefix = (legMap.get(lk) || []).join(' · '), caption = opNames[m.operation] + '(' + (m.name || 'Registros') + ')';
        datasets.push({
          name: prefix ? (prefix + (measures.length > 1 ? ' · ' + caption : '')) : (measures.length > 1 ? caption : (m.name || 'Registros')),
          data: ckeys.map(function (ck) { return aggregate(groups.get(ck + '\u0000' + lk) || [], m); }),
          measure: clone(m)
        });
      });
    });

    var ordered = applyOrdering(visual, labels, datasets);
    labels = ordered.labels; datasets = ordered.datasets;

    var tableRows = [];
    ckeys.forEach(function (ck) {
      lkeys.forEach(function (lk) {
        var group = groups.get(ck + '\u0000' + lk); if (!group) return;
        var row = {};
        cats.forEach(function (f, i) { row[f] = (catMap.get(ck) || [])[i]; });
        legs.forEach(function (f, i) { row[f] = (legMap.get(lk) || [])[i]; });
        measures.forEach(function (m) { row[opNames[m.operation] + '(' + (m.name || 'Registros') + ')'] = aggregate(group, m); });
        tableRows.push(row);
      });
    });

    return { filteredData: rows, dataset: { labels: labels, datasets: datasets, tableRows: tableRows, measures: measures }, activeFilters: all, kpiValue: aggregate(rows, measures[0]), kpiMeasure: measures[0] };
  }

  function UI() {
    this.canvas = document.getElementById('dashboardCanvas');
    this.cards = new Map(); this.charts = new Map(); this.grid = null; this.reader = null; this.importSession = null;
    this.initGrid(); this.bind(); this.bindImportAssistant();
  }

  UI.prototype.initGrid = function () {
    var self = this;
    if (!this.canvas || !window.GridStack) return;
    this.grid = GridStack.init({ column: 12, cellHeight: 72, margin: 10, disableOneColumnMode: false, oneColumnSize: 700, animate: true, handle: '.visual-drag-handle' }, this.canvas);
    this.grid.on('change', function (e, items) {
      items.forEach(function (item) { var v = state.visuals.find(function (x) { return x.id === item.el.dataset.visualId; }); if (v) { v.x = item.x; v.y = item.y; v.w = item.w; v.h = item.h; } });
      self.reflow();
    });
  };

  UI.prototype.reflow = function () { var self = this; requestAnimationFrame(function () { self.charts.forEach(function (chart) { chart.resize(); }); }); };

  function truncate(value) { value = String(value == null ? '' : value); return value.length > 24 ? value.slice(0, 23) + '…' : value; }
  function formatMetric(value, measure, options) { return Utils.formatValue(value, (measure && measure.format) || 'auto', options.decimalPlaces); }
  function displayLabel(value, percent, options, measure) {
    var formatted = formatMetric(value, measure, options);
    if (options.showValueAndPercentage || (options.showPercentage && options.showValues)) return formatted + '\n' + percent.toFixed(0) + '%';
    if (options.showPercentage) return percent.toFixed(0) + '%';
    return formatted;
  }

  function axisConfig(position, datasets, options) {
    var formats = Array.from(new Set(datasets.map(function (d) { return d.measure && d.measure.format || 'auto'; })));
    var format = formats.length === 1 ? formats[0] : 'compact';
    return {
      type: 'value', position: position,
      axisLabel: { color:'#475569', fontSize:11, formatter:function (value) { return Utils.formatValue(value, format === 'auto' ? 'compact' : format, options.decimalPlaces); } },
      axisLine: { show: true, lineStyle: { color:'#cbd5e1' } }, axisTick: { show:false },
      splitLine: position === 'left' ? { lineStyle:{ color:'#e5e7eb' } } : { show:false }
    };
  }

  UI.prototype.chartOption = function (visual, data) {
    var requested = visual.type;
    var baseType = ({ doughnut:'pie', pie:'pie', area:'line', bar:'bar', line:'line', radar:'radar', scatter:'scatter' })[requested] || 'bar';
    var options = visual.options, colors = palettes[options.automaticColors ? 'office' : options.palette] || palettes.office;
    var titleVisible = visual.header && visual.header.visible === false && visual.title, legendTop = titleVisible ? 38 : 8;
    var base = {
      color: colors, animation: options.showAnimations !== false,
      textStyle: { color:'#1f2937', fontFamily:'Inter, system-ui, sans-serif', fontWeight:600, fontSize:13 },
      title: titleVisible ? { text:visual.title, left:'center', top:4, textStyle:{ color:'#111827', fontSize:18, fontWeight:700 } } : undefined,
      legend: { show:options.showLegend !== false, type:data.datasets.length > 6 ? 'scroll' : 'plain', top:legendTop, icon:'roundRect', itemWidth:12, itemHeight:12, itemGap:14, textStyle:{ color:'#374151', fontSize:12, formatter:truncate } },
      tooltip: { show:options.showTooltip !== false, backgroundColor:'#111827', borderWidth:0, textStyle:{ color:'#f9fafb' }, extraCssText:'box-shadow:0 8px 24px rgba(15,23,42,.2);border-radius:8px;padding:10px 12px;' },
      grid: { left:58, right:32, top: options.showLegend === false ? 28 : 62, bottom: data.labels.length > 18 ? 72 : 48, containLabel:true }
    };

    if (baseType === 'pie') {
      var source = data.datasets[0] || { data:[], measure:{} };
      var pieData = data.labels.map(function (name, i) { return { name:name, value:source.data[i] || 0 }; });
      var total = pieData.reduce(function (sum, item) { return sum + Number(item.value || 0); }, 0);
      base.tooltip.trigger = 'item';
      base.tooltip.formatter = function (params) { var pct = total ? Number(params.value || 0) / total * 100 : 0; return '<strong>' + escapeHtml(params.name) + '</strong><br/>Valor: ' + escapeHtml(formatMetric(params.value, source.measure, options)) + '<br/>Participación: ' + pct.toFixed(1) + '%<br/>Total métrica: ' + escapeHtml(formatMetric(total, source.measure, options)); };
      base.legend.data = pieData.map(function (item) { return item.name; });
      base.series = [{ type:'pie', radius:requested === 'doughnut' ? ['45%','70%'] : '70%', center:['50%','56%'], avoidLabelOverlap:true, minShowLabelAngle:5, label:{ show:options.showLabels === true, position:'inside', color:'#fff', fontWeight:700, formatter:function (params) { return displayLabel(params.value, params.percent, options, source.measure); } }, labelLine:{ show:false }, data:pieData }];
      delete base.grid;
      return base;
    }

    if (baseType === 'radar') {
      var max = Math.max.apply(Math, data.datasets.reduce(function (all, series) { return all.concat(series.data); }, []).concat([1]));
      base.tooltip.formatter = function (params) { var item = Array.isArray(params) ? params[0] : params; return '<strong>' + escapeHtml(item.seriesName || '') + '</strong>'; };
      base.radar = { indicator:data.labels.map(function (name) { return { name:truncate(name), max:max }; }), name:{ color:'#374151', fontSize:12 } };
      base.series = data.datasets.map(function (series) { return { name:series.name, type:'radar', data:[{ value:series.data, name:series.name }] }; });
      delete base.grid;
      return base;
    }

    var assignments = Utils.axisAssignments(data.datasets);
    var leftDatasets = data.datasets.filter(function (_, i) { return assignments[i] === 0; });
    var rightDatasets = data.datasets.filter(function (_, i) { return assignments[i] === 1; });
    base.yAxis = rightDatasets.length ? [axisConfig('left', leftDatasets.length ? leftDatasets : data.datasets, options), axisConfig('right', rightDatasets, options)] : axisConfig('left', data.datasets, options);
    base.xAxis = { type:'category', data:data.labels, axisLabel:{ color:'#475569', fontSize:11, interval:0, rotate:data.labels.length > 12 ? 35 : 0, formatter:truncate }, axisLine:{ lineStyle:{ color:'#d1d5db' } } };
    if (data.labels.length > 24) base.dataZoom = [{ type:'slider', start:0, end:Math.min(100, 2400 / data.labels.length), height:18, bottom:8 }, { type:'inside' }];

    base.tooltip.trigger = 'axis';
    base.tooltip.axisPointer = { type: requested === 'bar' ? 'shadow' : 'line' };
    base.tooltip.formatter = function (params) {
      var rows = Array.isArray(params) ? params : [params], heading = rows[0] && (rows[0].axisValueLabel || rows[0].name) || '';
      var html = '<strong>' + escapeHtml(heading) + '</strong>';
      rows.forEach(function (item) {
        var series = data.datasets[item.seriesIndex] || { data:[], measure:{} }, value = Number(item.value) || 0;
        var seriesTotal = (series.data || []).reduce(function (sum, current) { return sum + (Number(current) || 0); }, 0);
        html += '<br/><span style="color:' + item.color + '">●</span> <strong>' + escapeHtml(item.seriesName) + '</strong><br/>Valor: ' + escapeHtml(formatMetric(value, series.measure, options));
        if ((series.data || []).length > 1 && seriesTotal) html += '<br/>Participación de la métrica: ' + (value / seriesTotal * 100).toFixed(1) + '%';
      });
      return html;
    };

    base.series = data.datasets.map(function (series, seriesIndex) {
      var total = series.data.reduce(function (a,b) { return a + Number(b || 0); }, 0), max = Math.max.apply(Math, series.data.map(function (v) { return Math.abs(Number(v) || 0); }).concat([1]));
      var requestedSeries = series.measure && series.measure.seriesType;
      var seriesType = requestedSeries && requestedSeries !== 'auto' ? requestedSeries : baseType;
      var values = series.data.map(function (value, index) {
        var pct = total ? Number(value || 0) / total * 100 : 0, inside = Math.abs(Number(value) || 0) >= max * .16, item = { value:value };
        if (seriesType === 'bar' && options.showLabels === true) item.label = { show:true, position:inside ? 'inside' : 'top', color:inside ? '#fff' : '#1f2937', fontWeight:700, fontSize:12, formatter:displayLabel(value, pct, options, series.measure) };
        if (seriesType === 'bar' && data.datasets.length === 1) item.itemStyle = { color:colors[index % colors.length] };
        return item;
      });
      return { name:series.name, type:seriesType, yAxisIndex:assignments[seriesIndex] || 0, data:values, areaStyle:requested === 'area' && seriesType === 'line' ? {} : undefined, smooth:seriesType === 'line', symbolSize:seriesType === 'scatter' ? 10 : undefined, label:{ show:false } };
    });
    return base;
  };

  UI.prototype.renderContent = function (card, visual, result) {
    var content = card.querySelector('.visual-content'), old = this.charts.get(visual.id);
    if (old) { old.dispose(); this.charts.delete(visual.id); }
    content.replaceChildren(); content.classList.remove('visual-kpi');

    if (visual.type === 'table') {
      var rows = result.dataset.tableRows || [], fields = Object.keys(rows[0] || {});
      if (!fields.length) { content.textContent = 'Configura campos para construir una tabla.'; return; }
      var table = document.createElement('table'), caption = document.createElement('caption'), head = table.createTHead().insertRow(), body = table.createTBody();
      table.className = 'dashboard-table'; caption.textContent = rows.length > 250 ? 'Mostrando 250 de ' + rows.length + ' filas' : rows.length + ' filas'; table.appendChild(caption);
      fields.forEach(function (field) { var th = document.createElement('th'); th.textContent = field; head.appendChild(th); });
      rows.slice(0,250).forEach(function (row) { var tr = body.insertRow(); fields.forEach(function (field) { tr.insertCell().textContent = text(row[field]); }); });
      content.appendChild(table); return;
    }

    if (visual.type === 'kpi') {
      var strong = document.createElement('strong'), captionKpi = document.createElement('span'), measure = result.kpiMeasure || normalizeMeasure({ operation:'count' });
      strong.textContent = formatMetric(result.kpiValue, measure, visual.options);
      captionKpi.textContent = opNames[measure.operation] + '(' + (measure.name || 'Registros') + ')';
      content.classList.add('visual-kpi'); content.append(strong, captionKpi); return;
    }

    if (window.echarts) {
      var el = document.createElement('div'); el.className = 'visual-chart'; content.appendChild(el);
      var chart = echarts.init(el); this.charts.set(visual.id, chart); chart.setOption(this.chartOption(visual, result.dataset), true);
    }
  };

  UI.prototype.renderAll = function () {
    var self = this, ids = new Set(state.visuals.map(function (v) { return v.id; }));
    this.cards.forEach(function (card, key) { if (!ids.has(key)) { var chart = self.charts.get(key); if (chart) chart.dispose(); self.charts.delete(key); self.cards.delete(key); if (self.grid) self.grid.removeWidget(card); else card.remove(); } });
    state.visuals.forEach(function (visual) {
      var card = self.cards.get(visual.id);
      if (!card) {
        card = document.createElement('article'); card.className = 'grid-stack-item visual-card'; card.dataset.visualId = visual.id;
        card.innerHTML = '<div class="grid-stack-item-content"><header><div class="visual-meta"><h2></h2><p class="visual-subtitle"></p><p class="visual-description"></p></div><div class="visual-actions"><button type="button" class="visual-drag-handle" aria-label="Arrastrar visual">⠿</button><button type="button" data-action="duplicate">Duplicar</button><button type="button" data-action="delete">Eliminar</button></div></header><div class="visual-content"></div></div>';
        card.addEventListener('click', function () { if (state.activeVisualId !== visual.id) { state.activeVisualId = visual.id; updateDashboard(); } });
        card.querySelector('.visual-actions').addEventListener('click', function (event) {
          var action = event.target.dataset.action; if (!action) return; event.stopPropagation();
          if (action === 'delete') { if (state.visuals.length === 1) return showToast('El dashboard debe conservar al menos una visualización.', 'info'); state.visuals = state.visuals.filter(function (item) { return item.id !== visual.id; }); state.activeVisualId = state.visuals[0].id; updateDashboard(); }
          if (action === 'duplicate') { var copy = normalizeVisual(clone(visual), state.visuals.length); copy.id = id(); copy.title = visual.title + ' (copia)'; copy.y = visual.y + visual.h; state.visuals.push(copy); state.activeVisualId = copy.id; updateDashboard(); }
        });
        self.cards.set(visual.id, card); if (self.grid) self.grid.addWidget(card, { x:visual.x, y:visual.y, w:visual.w, h:visual.h }); else self.canvas.appendChild(card);
      }
      card.classList.toggle('is-active', visual.id === state.activeVisualId);
      var settings = Object.assign({}, defaultHeader, visual.header || {}), header = card.querySelector('header'), meta = card.querySelector('.visual-meta'), h = card.querySelector('h2');
      header.hidden = !settings.visible; meta.style.textAlign = settings.align; h.textContent = visual.title || 'Sin título'; h.style.fontSize = Math.max(11, Number(settings.size) || 15) + 'px'; h.style.color = settings.color; h.style.fontWeight = settings.bold ? '700' : '400'; h.style.fontStyle = settings.italic ? 'italic' : 'normal';
      card.querySelector('.visual-subtitle').textContent = settings.showSubtitle ? visual.subtitle || '' : ''; card.querySelector('.visual-description').textContent = settings.showDescription ? visual.description || '' : '';
      if (self.grid) self.grid.update(card, { x:visual.x, y:visual.y, w:visual.w, h:visual.h });
      self.renderContent(card, visual, execute(visual));
    });
    this.reflow();
  };

  UI.prototype.bind = function () {
    var self = this;
    ['topFileInput','builderFileUpload'].forEach(function (id) { var input = document.getElementById(id); if (input) input.addEventListener('change', function () { var file = input.files && input.files[0]; self.loadFile(file); input.value = ''; }); });
  };

  UI.prototype.bindImportAssistant = function () {
    var self = this, close = function () { self.closeImportAssistant(); };
    var cancel = document.getElementById('importCancelBtn'), x = document.getElementById('importAssistantClose'), confirm = document.getElementById('importConfirmBtn'), sheet = document.getElementById('importSheetSelect');
    if (cancel) cancel.addEventListener('click', close); if (x) x.addEventListener('click', close); if (confirm) confirm.addEventListener('click', function () { self.importAssistantSelection(); });
    if (sheet) sheet.addEventListener('change', function () { if (self.importSession) { self.importSession.sheetName = sheet.value; self.importSession.headerIndex = null; self.renderImportAssistant(); } });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && self.importSession) close(); });
  };

  UI.prototype.renderImportAssistant = function () {
    var session = this.importSession, modal = document.getElementById('importAssistant'), logic = window.ImportAssistantLogic; if (!session || !modal) return;
    var rows = session.sheets[session.sheetName] || [], candidates = logic.findHeaderCandidates(rows);
    if (!candidates.some(function (candidate) { return candidate.index === session.headerIndex; })) session.headerIndex = candidates.length ? candidates[0].index : null;
    document.getElementById('importAssistantFile').textContent = session.file.name;
    var select = document.getElementById('importSheetSelect'); select.replaceChildren();
    Object.keys(session.sheets).forEach(function (name) { var option = document.createElement('option'); option.value = name; option.textContent = name; option.selected = name === session.sheetName; select.appendChild(option); });
    var list = document.getElementById('importHeaderCandidates'); list.replaceChildren();
    candidates.forEach(function (candidate) { var label = document.createElement('label'), radio = document.createElement('input'), detail = document.createElement('span'), sample = document.createElement('small'); label.className = 'import-candidate'; radio.type = 'radio'; radio.name = 'importHeaderRow'; radio.checked = candidate.index === session.headerIndex; radio.addEventListener('change', function () { session.headerIndex = candidate.index; this.renderImportAssistant(); }.bind(this)); detail.textContent = 'Fila ' + (candidate.index + 1) + ' · Puntaje ' + candidate.score; sample.textContent = candidate.values.join(' · '); label.append(radio, detail, sample); list.appendChild(label); }, this);
    if (!candidates.length) list.textContent = 'No se encontró una fila de encabezados válida en esta hoja.';
    var table = document.getElementById('importPreviewTable'); table.replaceChildren(); var first = Math.max(0, (session.headerIndex || 0) - 2), last = Math.min(rows.length, first + 8), width = Math.min(12, Math.max.apply(Math, [0].concat(rows.slice(first,last).map(function (r) { return r.length; }))));
    if (width) { var head = table.createTHead().insertRow(); head.insertCell().textContent = '#'; for (var col = 0; col < width; col++) head.insertCell().textContent = 'Col. ' + (col + 1); var body = table.createTBody(); for (var row = first; row < last; row++) { var tr = body.insertRow(); if (row === session.headerIndex) tr.className = 'is-header-row'; tr.insertCell().textContent = row + 1; for (var cell = 0; cell < width; cell++) tr.insertCell().textContent = rows[row][cell] == null ? '' : String(rows[row][cell]); } }
    document.getElementById('importConfirmBtn').disabled = session.headerIndex == null; modal.hidden = false;
  };

  UI.prototype.closeImportAssistant = function () { var modal = document.getElementById('importAssistant'); if (modal) modal.hidden = true; this.importSession = null; };
  UI.prototype.openImportAssistant = function (file, book, token) { var sheets = {}; book.SheetNames.forEach(function (name) { sheets[name] = XLSX.utils.sheet_to_json(book.Sheets[name], { header:1, defval:'', blankrows:true, raw:true }); }); this.importSession = { file:file, sheets:sheets, sheetName:book.SheetNames[0], headerIndex:null, token:token }; this.renderImportAssistant(); document.getElementById('importAssistantClose').focus(); };

  function loadRows(rows, sourceLabel) {
    if (!Array.isArray(rows) || !rows.length || typeof rows[0] !== 'object') throw new Error('El archivo no contiene filas de datos válidas.');
    var fields = Object.keys(rows[0]); if (!fields.length) throw new Error('No se detectaron columnas utilizables.');
    var measure = fields.find(function (field) { return Utils.inferNumeric(rows.slice(0,150).map(function (r) { return r[field]; })); });
    state.rawData = rows; state.sourceLabel = sourceLabel || 'Datos importados'; resetDatasetState(fields, measure);
    var label = document.getElementById('loadedFileName'); if (label) label.textContent = state.sourceLabel;
    var builder = document.getElementById('fieldBuilder'); if (builder) builder.hidden = false;
    updateDashboard(); clearError(); showToast('Datos importados correctamente.', 'success');
  }

  function restoreProject(payload, sourceLabel) {
    if (!payload || !Array.isArray(payload.rawData) || !Array.isArray(payload.visuals)) throw new Error('El respaldo no tiene un formato de proyecto válido.');
    state.rawData = clone(payload.rawData); state.globalFilters = (payload.globalFilters || []).map(normalizeFilter).filter(function (f) { return f.field; }); state.visuals = payload.visuals.map(normalizeVisual); if (!state.visuals.length) state.visuals = [defaultVisual({ title:'Visualización 1' })];
    state.activeVisualId = payload.activeVisualId && state.visuals.some(function (v) { return v.id === payload.activeVisualId; }) ? payload.activeVisualId : state.visuals[0].id;
    state.sourceLabel = sourceLabel || payload.sourceLabel || (payload.exportMetadata && payload.exportMetadata.source) || 'Proyecto restaurado';
    var label = document.getElementById('loadedFileName'); if (label) label.textContent = state.sourceLabel;
    var builder = document.getElementById('fieldBuilder'); if (builder) builder.hidden = !state.rawData.length;
    updateDashboard(); clearError(); showToast('Proyecto restaurado correctamente.', 'success');
  }

  UI.prototype.importAssistantSelection = function () {
    var session = this.importSession; if (!session || session.token !== loadGeneration || session.headerIndex == null) return;
    try { var data = window.ImportAssistantLogic.rowsFromHeader(session.sheets[session.sheetName], session.headerIndex); this.closeImportAssistant(); loadRows(data, session.file.name + ' · ' + session.sheetName + ' · encabezados fila ' + (session.headerIndex + 1)); }
    catch (err) { var target = document.getElementById('importAssistantError'); if (target) target.textContent = err.message; }
  };

  UI.prototype.loadJsonFile = function (file, token) {
    var self = this, reader = this.reader = new FileReader(); setBusy(true, 'Abriendo proyecto…');
    reader.onload = function (event) { if (token !== loadGeneration) return; try { var payload = JSON.parse(event.target.result); if (Array.isArray(payload)) loadRows(payload, file.name); else if (payload && Array.isArray(payload.rows) && !payload.visuals) loadRows(payload.rows, file.name); else restoreProject(payload, file.name); } catch (err) { showError('No fue posible abrir el JSON: ' + err.message); } finally { setBusy(false); } };
    reader.onerror = function () { if (token === loadGeneration) { setBusy(false); showError('No se pudo leer el archivo JSON.'); } };
    reader.readAsText(file, 'utf-8');
  };

  UI.prototype.loadFile = function (file) {
    if (!file) return; this.closeImportAssistant(); clearError();
    if (file.size > MAX_FILE_SIZE) return showError('El archivo supera el máximo permitido de 100 MB.');
    var token = ++loadGeneration, self = this;
    if (this.reader && this.reader.readyState === FileReader.LOADING) this.reader.abort();
    if (/\.json$/i.test(file.name) || file.type === 'application/json') return this.loadJsonFile(file, token);
    var reader = this.reader = new FileReader(); setBusy(true, 'Analizando archivo…');
    reader.onload = function (event) {
      if (token !== loadGeneration) return;
      try { if (!window.XLSX || !window.ImportAssistantLogic) throw new Error('El asistente de importación no está disponible.'); var book = XLSX.read(new Uint8Array(event.target.result), { type:'array', cellDates:true }); if (!book.SheetNames.length) throw new Error('El archivo no contiene hojas.'); self.openImportAssistant(file, book, token); }
      catch (err) { showError('No fue posible procesar el archivo: ' + err.message); }
      finally { setBusy(false); }
    };
    reader.onerror = function () { if (token === loadGeneration) { setBusy(false); showError('No se pudo leer el archivo.'); } };
    reader.onloadend = function () { if (self.reader === reader) self.reader = null; };
    reader.readAsArrayBuffer(file);
  };

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('El navegador no permite almacenamiento local avanzado.'));
      var request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE, { keyPath:'id' }); };
      request.onsuccess = function () { resolve(request.result); }; request.onerror = function () { reject(request.error || new Error('No fue posible abrir el almacenamiento local.')); };
    });
  }

  async function saveBrowserProject() {
    if (!state.rawData.length) throw new Error('Carga datos antes de guardar el proyecto.');
    var db = await openDb();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, 'readwrite'); tx.objectStore(DB_STORE).put({ id:'last', savedAt:new Date().toISOString(), sourceLabel:state.sourceLabel || (document.getElementById('loadedFileName') || {}).textContent || '', payload:clone(state) });
      tx.oncomplete = function () { db.close(); resolve(); }; tx.onerror = function () { db.close(); reject(tx.error || new Error('No se pudo guardar el proyecto.')); };
    });
  }

  async function readBrowserProject() {
    var db = await openDb();
    return new Promise(function (resolve, reject) { var tx = db.transaction(DB_STORE, 'readonly'), request = tx.objectStore(DB_STORE).get('last'); request.onsuccess = function () { db.close(); resolve(request.result || null); }; request.onerror = function () { db.close(); reject(request.error || new Error('No se pudo abrir el proyecto guardado.')); }; });
  }

  async function refreshSavedButton() {
    var button = document.getElementById('topLoadBtn'); if (!button) return;
    try { button.hidden = !(await readBrowserProject()); } catch (e) { button.hidden = true; }
  }

  var ui = new UI();

  function updateDashboard() {
    syncLegacy(); state.filteredData = globalRows(); ui.renderAll();
    if (window.renderFieldPanel) window.renderFieldPanel();
    return execute(active()).dataset;
  }

  function addVisual() {
    if (!state.rawData.length) return showToast('Primero carga un archivo de datos.', 'info');
    var source = active(), visual = defaultVisual({ title:'Gráfico ' + (state.visuals.length + 1), y:state.visuals.reduce(function (max, item) { return Math.max(max, item.y + item.h); }, 0) });
    if (source) { visual.categories = clone(source.categories); visual.values = clone(source.values); visual.legends = clone(source.legends); visual.filters = clone(source.filters); visual.options = clone(source.options); }
    state.visuals.push(visual); state.activeVisualId = visual.id; updateDashboard();
  }

  window.updateDashboard = updateDashboard;
  window.addDashboardVisual = addVisual;
  window.dashboardVisualActions = { duplicate:function (visualId) { var card = ui.cards.get(visualId); if (card) card.querySelector('[data-action="duplicate"]').click(); } };
  window.dashboardQueryEngine = { execute:execute, globalRows:globalRows, aggregate:aggregate };
  window.dashboardProject = { restore:restoreProject, save:saveBrowserProject, load:readBrowserProject };
  window.__APP__ = { initialized:true, ui:ui, updateDashboard:updateDashboard, addVisual:addVisual, getActiveVisual:active, operationLabel:function (m) { return opNames[m.operation] || 'Suma'; } };

  window.addEventListener('resize', function () { ui.reflow(); });
  var newButton = document.getElementById('topNewBtn'); if (newButton) newButton.addEventListener('click', addVisual);
  ['topSaveBtn','builderSaveBtn'].forEach(function (buttonId) { var button = document.getElementById(buttonId); if (!button) return; button.addEventListener('click', async function () { var original = button.textContent; button.disabled = true; button.textContent = 'Guardando…'; try { await saveBrowserProject(); showToast('Proyecto guardado en este navegador.', 'success'); await refreshSavedButton(); } catch (err) { showError(err.message); } finally { button.disabled = false; button.textContent = original; } }); });
  var loadButton = document.getElementById('topLoadBtn'); if (loadButton) loadButton.addEventListener('click', async function () { try { var saved = await readBrowserProject(); if (!saved) return showToast('No hay un proyecto guardado.', 'info'); restoreProject(saved.payload, saved.sourceLabel || 'Proyecto guardado'); } catch (err) { showError(err.message); } });

  updateDashboard(); refreshSavedButton();
})();
