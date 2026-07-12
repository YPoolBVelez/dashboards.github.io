/* Persistent dashboard-level filter surface. Kept separate from the visual editor
   so global controls remain visible while the active visual changes. */
(function () {
  'use strict';
  var state = window.dashboardState;
  if (!state) return;
  var root = document.getElementById('globalFilters');
  var summary = document.getElementById('globalFilterSummary');
  var clear = document.getElementById('clearGlobalFilters');
  if (!root) return;

  function refresh() {
    var filters = state.globalFilters || [];
    root.replaceChildren();
    if (summary) summary.textContent = filters.length
      ? filters.length + ' filtro' + (filters.length === 1 ? '' : 's') + ' global' + (filters.length === 1 ? '' : 'es') + ' aplicado' + (filters.length === 1 ? '' : 's') + ' automáticamente a todas las visualizaciones.'
      : 'Arrastra un campo a Filtros y elige “Global” para aplicarlo a todas las visualizaciones.';
    filters.forEach(function (filter) {
      var values = Array.from(new Set(state.rawData.map(function (row) { return String(row[filter.field] == null ? '' : row[filter.field]).trim(); }))).filter(Boolean).sort();
      var card = document.createElement('fieldset');
      var legend = document.createElement('legend');
      var choices = document.createElement('div');
      card.className = 'global-filter';
      legend.textContent = filter.field + ' · ' + (filter.values || []).length + '/' + values.length + ' seleccionados';
      values.forEach(function (value) {
        var label = document.createElement('label');
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = (filter.values || []).indexOf(value) !== -1;
        checkbox.addEventListener('change', function () {
          filter.values = checkbox.checked ? (filter.values || []).concat([value]) : (filter.values || []).filter(function (item) { return item !== value; });
          window.updateDashboard();
        });
        label.append(checkbox, document.createTextNode(value));
        choices.appendChild(label);
      });
      card.append(legend, choices);
      root.appendChild(card);
    });
  }

  if (clear) clear.addEventListener('click', function () {
    (state.globalFilters || []).forEach(function (filter) { filter.values = []; });
    window.updateDashboard();
  });
  var previous = window.renderFieldPanel;
  window.renderFieldPanel = function () { if (previous) previous(); refresh(); };
  refresh();
})();
