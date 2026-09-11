/* Constructor visual de producción: campos, métricas, filtros y formato por serie. */
(function () {
  'use strict';
  var state = window.dashboardState, Utils = window.DashboardChartUtils;
  if (!state || !Utils) return;

  var list = document.getElementById('fieldList'), search = document.getElementById('fieldSearch'), count = document.getElementById('fieldCount'), filterRoot = document.getElementById('dynamicFilters'), type = document.getElementById('builderChartType'), title = document.getElementById('chartTitle'), palette = document.getElementById('chartPalette'), hint = document.getElementById('visualHint'), subtitle = document.getElementById('visualSubtitle'), description = document.getElementById('visualDescription'), dragged;
  var header = { visible:'headerVisible', showSubtitle:'headerShowSubtitle', showDescription:'headerShowDescription', align:'headerAlign', font:'headerFont', size:'headerSize', color:'headerColor', spacing:'headerSpacing', bold:'headerBold', italic:'headerItalic' };
  var options = { showLegend:'showLegend', showLabels:'showLabels', showPercentage:'showPercentage', showValues:'showValues', showValueAndPercentage:'showValueAndPercentage', showTooltip:'showTooltip', automaticColors:'automaticColors', showAnimations:'showAnimations', decimalPlaces:'decimalPlaces', sortDirection:'sortDirection', topN:'topN' };
  var ops = { sum:'Suma', average:'Promedio', count:'Conteo', distinct:'Conteo distinto', max:'Máximo', min:'Mínimo', median:'Mediana', mode:'Moda', variance:'Varianza', stddev:'Desviación estándar', percentile:'Percentil' };

  function current() { return state.visuals.find(function (v) { return v.id === state.activeVisualId; }); }
  function update() { window.updateDashboard(); }
  function name(v) { return typeof v === 'string' ? v : v && (v.name || v.field); }
  function key(zone) { return { filters:'filters', legend:'legends', category:'categories', values:'values' }[zone]; }

  function add(zone, field, index) {
    var visual = current(), target = key(zone); if (!visual || !target || !field) return;
    if (zone !== 'values' && visual[target].some(function (item) { return name(item) === field; })) return;
    if (zone === 'values' && (visual.type === 'pie' || visual.type === 'doughnut') && visual.values.length >= 1) { if (hint) hint.textContent = 'Pie y Dona admiten una sola métrica. Usa Barras o Líneas para comparar varias.'; return; }
    var item = zone === 'filters' ? { field:field, scope:'local', values:[], matchNone:false } : zone === 'values' ? { name:field, operation:'sum', percentile:50, axis:'auto', seriesType:'auto', format:'auto' } : field;
    if (index == null) visual[target].push(item); else visual[target].splice(index, 0, item);
    update();
  }

  function remove(zone, index) {
    var visual = current(), target = key(zone); if (!visual || !target || index < 0 || index >= visual[target].length) return;
    var item = visual[target][index], field = name(item); visual[target].splice(index, 1);
    if (zone === 'filters' && item.scope === 'global') {
      state.globalFilters = (state.globalFilters || []).filter(function (filter) { return filter.field !== field; });
      state.visuals.forEach(function (v) { (v.filters || []).forEach(function (filter) { if (filter.field === field && filter.scope === 'global') filter.scope = 'local'; }); });
    }
    update();
  }

  function fields() {
    return Object.keys(state.rawData[0] || {}).map(function (field) {
      var sample = state.rawData.slice(0,150).map(function (row) { return row[field]; });
      return { name:field, numeric:Utils.inferNumeric(sample) };
    });
  }

  function selectControl(className, values, selected, onChange) {
    var select = document.createElement('select'); select.className = className;
    values.forEach(function (pair) { select.add(new Option(pair[1], pair[0], false, selected === pair[0])); });
    select.onchange = function () { onChange(select.value); };
    return select;
  }

  function chip(zone, item, index) {
    var field = name(item), node = document.createElement('article'), handle = document.createElement('button'), label = document.createElement('span'), close = document.createElement('button');
    node.className = 'field-chip' + (zone === 'values' ? ' metric-chip' : ''); node.draggable = true; node.dataset.index = index;
    handle.type = 'button'; handle.className = 'chip-handle'; handle.textContent = '⠿'; handle.setAttribute('aria-label', 'Reordenar ' + field);
    label.className = 'chip-name'; label.textContent = field;
    close.type = 'button'; close.className = 'chip-remove'; close.textContent = '×'; close.setAttribute('aria-label', 'Quitar ' + field); close.onclick = function () { remove(zone, index); };
    node.append(handle, label);

    if (zone === 'filters') {
      var scope = selectControl('chip-scope', [['local','Local'],['global','Global']], item.scope === 'global' ? 'global' : 'local', function (value) {
        var globals = state.globalFilters || [], existing = globals.find(function (f) { return f.field === field; });
        if (value === 'global') {
          if (!existing) { existing = { field:field, scope:'global', values:(item.values || []).slice(), matchNone:!!item.matchNone }; globals.push(existing); }
          item.scope = 'global'; item.values = existing.values || []; item.matchNone = !!existing.matchNone;
        } else {
          item.scope = 'local'; item.values = existing ? (existing.values || []).slice() : (item.values || []); item.matchNone = existing ? !!existing.matchNone : !!item.matchNone;
          state.globalFilters = globals.filter(function (f) { return f.field !== field; });
          state.visuals.forEach(function (v) { (v.filters || []).forEach(function (f) { if (f !== item && f.field === field && f.scope === 'global') f.scope = 'local'; }); });
        }
        update();
      });
      node.appendChild(scope);
    }

    if (zone === 'values') {
      var controls = document.createElement('div'); controls.className = 'metric-controls';
      controls.append(
        selectControl('chip-operation', Object.keys(ops).map(function (op) { return [op, ops[op]]; }), item.operation || 'sum', function (value) { item.operation = value; update(); }),
        selectControl('chip-axis', [['auto','Eje auto'],['left','Eje izq.'],['right','Eje der.']], item.axis || 'auto', function (value) { item.axis = value; update(); }),
        selectControl('chip-series', [['auto','Tipo auto'],['bar','Barra'],['line','Línea'],['scatter','Puntos']], item.seriesType || 'auto', function (value) { item.seriesType = value; update(); }),
        selectControl('chip-format', [['auto','Número'],['currency','CLP'],['percent','%'],['compact','Abreviado']], item.format || 'auto', function (value) { item.format = value; update(); })
      );
      if (item.operation === 'percentile') { var percentile = document.createElement('input'); percentile.type = 'number'; percentile.min = 0; percentile.max = 100; percentile.value = item.percentile || 50; percentile.className = 'chip-percentile'; percentile.title = 'Percentil'; percentile.onchange = function () { item.percentile = Math.max(0, Math.min(100, Number(percentile.value) || 50)); update(); }; controls.appendChild(percentile); }
      node.appendChild(controls);
    }

    node.appendChild(close);
    node.addEventListener('dragstart', function (event) { dragged = { zone:zone, index:index, field:field, internal:true }; event.dataTransfer.setData('text/plain', field); });
    return node;
  }

  function filterValues(field) {
    return Array.from(new Set(state.rawData.map(function (row) { return String(row[field] == null ? '' : row[field]).trim(); }))).filter(Boolean).sort(function (a,b) { return a.localeCompare(b, 'es', { numeric:true, sensitivity:'base' }); });
  }

  function renderFilters(visual) {
    if (!filterRoot) return; filterRoot.replaceChildren();
    visual.filters.forEach(function (filter) {
      var model = filter.scope === 'global' ? (state.globalFilters || []).find(function (f) { return f.field === filter.field; }) : filter;
      if (!model) return; model.values = Array.isArray(model.values) ? model.values : []; model.matchNone = !!model.matchNone;
      var set = document.createElement('fieldset'), legend = document.createElement('legend'), tools = document.createElement('div'), all = document.createElement('button'), none = document.createElement('button'), choices = document.createElement('div'), values = filterValues(filter.field);
      set.className = 'dynamic-filter'; legend.textContent = filter.field + ' · ' + (filter.scope === 'global' ? 'Global' : 'Local');
      all.type = none.type = 'button'; all.textContent = 'Todos'; none.textContent = 'Ninguno';
      all.onclick = function () { model.values = []; model.matchNone = false; update(); };
      none.onclick = function () { model.values = []; model.matchNone = true; update(); };
      tools.className = 'filter-tools'; tools.append(all, none);
      if (!values.length) { var empty = document.createElement('p'); empty.textContent = 'No hay valores disponibles para este filtro.'; choices.appendChild(empty); }
      values.forEach(function (value) {
        var option = document.createElement('label'), box = document.createElement('input'); box.type = 'checkbox'; box.checked = !model.matchNone && (model.values.length === 0 || model.values.indexOf(value) !== -1);
        box.onchange = function () { Utils.toggleFilterValue(model, value, box.checked, values); update(); };
        option.append(box, document.createTextNode(value)); choices.appendChild(option);
      });
      set.append(legend, tools, choices); filterRoot.appendChild(set);
    });
  }

  function visualHint(visual) {
    if (visual.type === 'pie' || visual.type === 'doughnut') {
      if (visual.values.length > 1 || visual.legends.length) return 'Pie y Dona representan una sola métrica. Se utilizará únicamente la primera serie; para comparar varias usa Barras o Líneas.';
      return 'Ideal para participación de una sola métrica entre categorías.';
    }
    if (visual.type === 'radar' && visual.values.length > 1) return 'Radar funciona mejor con métricas de unidades comparables. Para Precio + Conteo usa un gráfico combinado.';
    if (visual.type === 'kpi' && visual.values.length > 1) return 'KPI utiliza la primera métrica y calcula su agregado sobre todos los registros filtrados.';
    return 'Cambios aplicados al instante.';
  }

  function render() {
    var visual = current(); if (!visual) return;
    ['categories','legends','values','filters'].forEach(function (k) { visual[k] = Array.isArray(visual[k]) ? visual[k] : []; });
    var allFields = fields(); if (count) count.textContent = allFields.length + ' campos'; if (type) type.value = visual.type; if (title) title.value = visual.title || ''; if (subtitle) subtitle.value = visual.subtitle || ''; if (description) description.value = visual.description || '';
    if (palette) { palette.value = visual.options.palette || 'office'; palette.disabled = visual.options.automaticColors !== false; }
    if (hint) { hint.textContent = visualHint(visual); hint.dataset.warning = (visual.type === 'pie' || visual.type === 'doughnut') && visual.values.length > 1 ? 'true' : 'false'; }

    document.querySelectorAll('.drop-zone').forEach(function (zone) { var target = key(zone.dataset.zone), root = zone.querySelector('.zone-content'); root.replaceChildren(); visual[target].forEach(function (item, i) { root.appendChild(chip(zone.dataset.zone, item, i)); }); });
    Object.keys(header).forEach(function (k) { var control = document.getElementById(header[k]); if (control) control[control.type === 'checkbox' ? 'checked' : 'value'] = visual.header[k]; });
    Object.keys(options).forEach(function (k) { var control = document.getElementById(options[k]); if (control) control[control.type === 'checkbox' ? 'checked' : 'value'] = visual.options[k]; });
    renderFilters(visual);

    if (list) {
      var query = (search && search.value || '').toLocaleLowerCase('es'); list.replaceChildren();
      allFields.filter(function (field) { return !query || field.name.toLocaleLowerCase('es').includes(query); }).forEach(function (field) {
        var button = document.createElement('button'); button.type = 'button'; button.className = 'field-item'; button.draggable = true; button.textContent = (field.numeric ? '∑ ' : 'T ') + field.name;
        button.onclick = function () { add(field.numeric ? 'values' : 'category', field.name); };
        button.addEventListener('dragstart', function (event) { dragged = { field:field.name, internal:false }; event.dataTransfer.setData('text/plain', field.name); }); list.appendChild(button);
      });
    }
  }

  window.renderFieldPanel = render;
  if (search) search.oninput = render;
  if (type) type.onchange = function () { current().type = type.value; update(); };
  if (title) title.oninput = function () { current().title = title.value; update(); };
  if (subtitle) subtitle.oninput = function () { current().subtitle = subtitle.value; update(); };
  if (description) description.oninput = function () { current().description = description.value; update(); };
  if (palette) palette.onchange = function () { current().options.palette = palette.value; update(); };

  Object.keys(header).forEach(function (k) { var control = document.getElementById(header[k]); if (control) control.onchange = function () { current().header[k] = control.type === 'checkbox' ? control.checked : (k === 'size' || k === 'spacing' ? Number(control.value) : control.value); update(); }; });
  Object.keys(options).forEach(function (k) { var control = document.getElementById(options[k]); if (control) control.onchange = function () { current().options[k] = control.type === 'checkbox' ? control.checked : (k === 'sortDirection' ? control.value : Number(control.value)); update(); }; });

  document.querySelectorAll('.drop-zone').forEach(function (zone) {
    zone.addEventListener('dragover', function (event) { event.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', function (event) {
      event.preventDefault(); zone.classList.remove('drag-over'); var target = zone.dataset.zone, chipTarget = event.target.closest('.field-chip'), at = chipTarget ? Number(chipTarget.dataset.index) : current()[key(target)].length; if (!dragged) return;
      if (dragged.internal && dragged.zone === target) { var items = current()[key(target)], item = items.splice(dragged.index, 1)[0]; if (dragged.index < at) at--; items.splice(Math.max(0, at), 0, item); update(); }
      else { if (dragged.internal) { var sourceItems = current()[key(dragged.zone)]; sourceItems.splice(dragged.index, 1); } add(target, dragged.field, at); }
      dragged = null;
    });
  });

  render();
})();
