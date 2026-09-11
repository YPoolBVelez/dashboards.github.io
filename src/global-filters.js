/* Filtros globales persistentes y coherentes con el motor de consulta. */
(function () {
  'use strict';
  var state = window.dashboardState, Utils = window.DashboardChartUtils;
  if (!state || !Utils) return;
  var root = document.getElementById('globalFilters'), summary = document.getElementById('globalFilterSummary'), clear = document.getElementById('clearGlobalFilters');
  if (!root) return;

  function valuesFor(field) {
    return Array.from(new Set(state.rawData.map(function (row) { return String(row[field] == null ? '' : row[field]).trim(); }))).filter(Boolean).sort(function (a,b) { return a.localeCompare(b, 'es', { numeric:true, sensitivity:'base' }); });
  }

  function refresh() {
    var filters = state.globalFilters || []; root.replaceChildren();
    if (summary) summary.textContent = filters.length ? filters.length + ' filtro' + (filters.length === 1 ? '' : 's') + ' global' + (filters.length === 1 ? '' : 'es') + ' aplicado' + (filters.length === 1 ? '' : 's') + ' a todas las visualizaciones.' : 'Arrastra un campo a Filtros y elige “Global” para aplicarlo a todo el dashboard.';

    filters.forEach(function (filter) {
      filter.values = Array.isArray(filter.values) ? filter.values : []; filter.matchNone = !!filter.matchNone;
      var values = valuesFor(filter.field), card = document.createElement('fieldset'), legend = document.createElement('legend'), tools = document.createElement('div'), all = document.createElement('button'), none = document.createElement('button'), choices = document.createElement('div');
      card.className = 'global-filter';
      var selectedText = filter.matchNone ? 'ninguno' : (filter.values.length ? filter.values.length + '/' + values.length : 'todos');
      legend.textContent = filter.field + ' · ' + selectedText;
      tools.className = 'filter-tools'; all.type = none.type = 'button'; all.textContent = 'Todos'; none.textContent = 'Ninguno';
      all.onclick = function () { filter.values = []; filter.matchNone = false; window.updateDashboard(); };
      none.onclick = function () { filter.values = []; filter.matchNone = true; window.updateDashboard(); };
      tools.append(all, none);

      values.forEach(function (value) {
        var label = document.createElement('label'), checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !filter.matchNone && (filter.values.length === 0 || filter.values.indexOf(value) !== -1);
        checkbox.addEventListener('change', function () { Utils.toggleFilterValue(filter, value, checkbox.checked, values); window.updateDashboard(); });
        label.append(checkbox, document.createTextNode(value)); choices.appendChild(label);
      });
      card.append(legend, tools, choices); root.appendChild(card);
    });
  }

  if (clear) clear.addEventListener('click', function () { (state.globalFilters || []).forEach(function (filter) { filter.values = []; filter.matchNone = false; }); window.updateDashboard(); });
  var previous = window.renderFieldPanel;
  window.renderFieldPanel = function () { if (previous) previous(); refresh(); };
  refresh();
})();
