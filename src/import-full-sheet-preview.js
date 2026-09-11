/* Importación completa de una hoja Excel en una sola operación.
   La vista previa es opcional y solo muestra una muestra; nunca divide la carga real. */
(function () {
  'use strict';

  var app = window.__APP__;
  var logic = window.ImportAssistantLogic;
  var workbookLogic = window.ImportWorkbookLogic;
  if (!app || !app.ui || !logic) return;

  var ui = app.ui;
  var originalRender = ui.renderImportAssistant.bind(ui);
  var SAMPLE_SIZE = 20;

  function formatCount(value) {
    return new Intl.NumberFormat('es-CL').format(Number(value) || 0);
  }

  function prepareWorkbookSession() {
    var session = ui.importSession;
    if (!session || !workbookLogic) return;
    if (!session.workbookAnalysis) session.workbookAnalysis = workbookLogic.analyzeWorkbook(session.sheets || {});
    if (session.workbookAutoSelected) return;

    var best = session.workbookAnalysis && session.workbookAnalysis.best;
    if (best && best.headerIndex != null && best.rowCount > 0) {
      session.sheetName = best.name;
      session.headerIndex = best.headerIndex;
      session.workbookAutoSelectedName = best.name;
    }
    session.previewExpanded = false;
    session.workbookAutoSelected = true;
  }

  function ensureWorkbookInsight() {
    var select = document.getElementById('importSheetSelect');
    if (!select) return null;
    var label = select.closest('.import-sheet-label');
    if (!label) return null;

    var insight = document.getElementById('importWorkbookInsight');
    if (!insight) {
      insight = document.createElement('div');
      insight.id = 'importWorkbookInsight';
      insight.className = 'import-workbook-insight';
      insight.setAttribute('aria-live', 'polite');
      label.insertAdjacentElement('afterend', insight);
    }
    return insight;
  }

  function decorateSheetSelector() {
    var session = ui.importSession;
    var select = document.getElementById('importSheetSelect');
    if (!session || !select || !session.workbookAnalysis || !workbookLogic) return;

    Array.from(select.options).forEach(function (option) {
      var stat = workbookLogic.byName(session.workbookAnalysis, option.value);
      if (!stat) return;
      option.textContent = stat.rowCount
        ? stat.name + ' — ' + formatCount(stat.rowCount) + ' filas · ' + formatCount(stat.columnCount) + ' columnas'
        : stat.name + ' — sin datos tabulares detectados';
    });

    var insight = ensureWorkbookInsight();
    if (!insight) return;
    insight.replaceChildren();

    var current = workbookLogic.byName(session.workbookAnalysis, session.sheetName);
    var best = session.workbookAnalysis.best;
    var copy = document.createElement('div');
    copy.className = 'import-workbook-insight-copy';

    var title = document.createElement('strong');
    title.textContent = 'Libro con ' + formatCount(session.workbookAnalysis.sheets.length) + ' hoja' + (session.workbookAnalysis.sheets.length === 1 ? '' : 's') + '.';
    var detail = document.createElement('span');

    if (best && session.workbookAutoSelectedName === best.name && current && current.name === best.name) {
      detail.textContent = ' Seleccionamos automáticamente “' + best.name + '” porque es la hoja con más datos detectados (' + formatCount(best.rowCount) + ' filas).';
    } else if (current) {
      detail.textContent = ' Hoja actual: “' + current.name + '” (' + formatCount(current.rowCount) + ' filas detectadas con el encabezado recomendado).';
    }
    copy.append(title, detail);
    insight.appendChild(copy);

    if (best && current && current.name !== best.name) {
      var useBest = document.createElement('button');
      useBest.type = 'button';
      useBest.className = 'quiet-action import-use-largest-sheet';
      useBest.textContent = 'Usar hoja con más datos: ' + best.name + ' (' + formatCount(best.rowCount) + ')';
      useBest.addEventListener('click', function () {
        if (!ui.importSession) return;
        ui.importSession.sheetName = best.name;
        ui.importSession.headerIndex = best.headerIndex;
        ui.importSession.previewExpanded = false;
        ui.renderImportAssistant();
      });
      insight.appendChild(useBest);
    }
  }

  function updateAssistantCopy() {
    var steps = document.querySelectorAll('#importAssistant .import-steps li');
    if (steps[3]) steps[3].textContent = '4 Confirmar';
    var preview = document.getElementById('importPreviewTable');
    var section = preview && preview.closest('section');
    var heading = section && section.querySelector('h3');
    if (heading) heading.textContent = 'Muestra opcional de datos';
  }

  function ensureImportSummary() {
    var table = document.getElementById('importPreviewTable');
    if (!table) return null;
    var preview = table.closest('.import-preview');
    if (!preview) return null;

    var summary = document.getElementById('importPreviewSummary');
    if (!summary) {
      summary = document.createElement('div');
      summary.id = 'importPreviewSummary';
      summary.className = 'import-preview-summary import-preview-summary--single';
      summary.setAttribute('aria-live', 'polite');

      var copy = document.createElement('div');
      copy.className = 'import-preview-summary-copy';
      var headline = document.createElement('strong');
      headline.id = 'importPreviewHeadline';
      var detail = document.createElement('span');
      detail.id = 'importPreviewDetail';
      copy.append(headline, detail);

      var actions = document.createElement('div');
      actions.className = 'import-preview-actions';
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.id = 'importPreviewToggle';
      toggle.className = 'quiet-action import-preview-toggle';
      toggle.addEventListener('click', function () {
        if (!ui.importSession) return;
        ui.importSession.previewExpanded = !ui.importSession.previewExpanded;
        ui.renderImportAssistant();
      });
      actions.appendChild(toggle);

      summary.append(copy, actions);
      preview.parentNode.insertBefore(summary, preview);
    }
    return summary;
  }

  function renderSample(table, rows, columns) {
    table.replaceChildren();
    if (!columns.length || !rows.length) return;

    var thead = table.createTHead();
    var head = thead.insertRow();
    var rowNumber = document.createElement('th');
    rowNumber.scope = 'col';
    rowNumber.textContent = '#';
    head.appendChild(rowNumber);
    columns.forEach(function (column) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = column;
      head.appendChild(th);
    });

    var body = table.createTBody();
    rows.slice(0, SAMPLE_SIZE).forEach(function (row, offset) {
      var tr = body.insertRow();
      tr.insertCell().textContent = formatCount(offset + 1);
      columns.forEach(function (column) {
        var cell = tr.insertCell();
        var cellValue = row[column];
        if (cellValue instanceof Date && !Number.isNaN(cellValue.getTime())) {
          cell.textContent = new Intl.DateTimeFormat('es-CL', { year:'numeric', month:'2-digit', day:'2-digit' }).format(cellValue);
        } else {
          cell.textContent = cellValue == null ? '' : String(cellValue);
        }
      });
    });
  }

  function renderWholeSheetImport() {
    var session = ui.importSession;
    var table = document.getElementById('importPreviewTable');
    var summary = ensureImportSummary();
    if (!session || !table || !summary) return;

    updateAssistantCopy();

    var preview = table.closest('.import-preview');
    var confirm = document.getElementById('importConfirmBtn');
    var headline = document.getElementById('importPreviewHeadline');
    var detail = document.getElementById('importPreviewDetail');
    var toggle = document.getElementById('importPreviewToggle');
    var rows = session.sheets[session.sheetName] || [];

    if (session.headerIndex == null) {
      headline.textContent = 'Selecciona la fila que contiene los encabezados.';
      detail.textContent = 'La fila seleccionada define los nombres de columnas. Después podrás importar la hoja completa en una sola operación.';
      table.replaceChildren();
      if (preview) preview.hidden = true;
      if (toggle) toggle.hidden = true;
      if (confirm) { confirm.disabled = true; confirm.textContent = 'Importar hoja completa'; }
      return;
    }

    var importedRows = logic.rowsFromHeader(rows, session.headerIndex);
    var columns = Object.keys(importedRows[0] || {});
    var availableRows = Math.max(0, rows.length - session.headerIndex - 1);
    var ignoredBlankRows = Math.max(0, availableRows - importedRows.length);

    headline.textContent = 'Hoja completa lista: “' + session.sheetName + '” · ' + formatCount(importedRows.length) + ' filas · ' + formatCount(columns.length) + ' columnas';
    detail.textContent = 'Se importarán todas las filas con datos en una sola carga desde el encabezado de la fila ' + (session.headerIndex + 1) + '.' + (ignoredBlankRows ? ' Se omiten únicamente ' + formatCount(ignoredBlankRows) + ' filas completamente vacías.' : '');

    if (toggle) {
      toggle.hidden = !importedRows.length;
      toggle.textContent = session.previewExpanded ? 'Ocultar muestra' : 'Ver muestra de ' + Math.min(SAMPLE_SIZE, importedRows.length) + ' filas';
      toggle.setAttribute('aria-expanded', session.previewExpanded ? 'true' : 'false');
    }

    if (preview) preview.hidden = !session.previewExpanded;
    if (session.previewExpanded) renderSample(table, importedRows, columns);
    else table.replaceChildren();

    if (confirm) {
      confirm.disabled = !importedRows.length;
      confirm.textContent = importedRows.length ? ('Importar hoja completa (' + formatCount(importedRows.length) + ' filas)') : 'Sin datos para importar';
      confirm.title = importedRows.length ? ('Importará todas las ' + formatCount(importedRows.length) + ' filas con datos de la hoja ' + session.sheetName + ' en una sola operación.') : '';
    }
  }

  ui.renderImportAssistant = function () {
    prepareWorkbookSession();
    originalRender();
    renderWholeSheetImport();
    decorateSheetSelector();
  };
})();
