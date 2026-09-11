/* Vista paginada de toda la hoja para el Asistente de Importación.
   La paginación afecta solo a la vista previa: la importación usa todas las filas con datos.
   Además analiza el libro completo para evitar abrir por defecto una hoja resumen. */
(function () {
  'use strict';

  var app = window.__APP__;
  var logic = window.ImportAssistantLogic;
  var workbookLogic = window.ImportWorkbookLogic;
  if (!app || !app.ui || !logic) return;

  var ui = app.ui;
  var originalRender = ui.renderImportAssistant.bind(ui);

  function formatCount(value) {
    return new Intl.NumberFormat('es-CL').format(Number(value) || 0);
  }

  function createButton(label, title, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'import-preview-page-button';
    button.textContent = label;
    button.title = title;
    button.addEventListener('click', onClick);
    return button;
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
      session.previewPage = 1;
      session.workbookAutoSelectedName = best.name;
    }
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
        ui.importSession.previewPage = 1;
        ui.renderImportAssistant();
      });
      insight.appendChild(useBest);
    }
  }

  function ensurePreviewChrome() {
    var table = document.getElementById('importPreviewTable');
    if (!table) return null;
    var preview = table.closest('.import-preview');
    if (!preview) return null;

    var summary = document.getElementById('importPreviewSummary');
    if (!summary) {
      summary = document.createElement('div');
      summary.id = 'importPreviewSummary';
      summary.className = 'import-preview-summary';
      summary.setAttribute('aria-live', 'polite');

      var copy = document.createElement('div');
      copy.className = 'import-preview-summary-copy';
      var headline = document.createElement('strong');
      headline.id = 'importPreviewHeadline';
      var detail = document.createElement('span');
      detail.id = 'importPreviewDetail';
      copy.append(headline, detail);

      var pager = document.createElement('div');
      pager.className = 'import-preview-pager';

      var first = createButton('«', 'Primera página', function () {
        if (!ui.importSession) return;
        ui.importSession.previewPage = 1;
        ui.renderImportAssistant();
      });
      first.id = 'importPreviewFirst';

      var previous = createButton('‹', 'Página anterior', function () {
        if (!ui.importSession) return;
        ui.importSession.previewPage = Math.max(1, (ui.importSession.previewPage || 1) - 1);
        ui.renderImportAssistant();
      });
      previous.id = 'importPreviewPrevious';

      var page = document.createElement('span');
      page.id = 'importPreviewPage';
      page.className = 'import-preview-page-label';

      var next = createButton('›', 'Página siguiente', function () {
        if (!ui.importSession) return;
        ui.importSession.previewPage = (ui.importSession.previewPage || 1) + 1;
        ui.renderImportAssistant();
      });
      next.id = 'importPreviewNext';

      var last = createButton('»', 'Última página', function () {
        if (!ui.importSession) return;
        ui.importSession.previewPage = Number(ui.importSession.previewTotalPages) || 1;
        ui.renderImportAssistant();
      });
      last.id = 'importPreviewLast';

      var sizeLabel = document.createElement('label');
      sizeLabel.className = 'import-preview-size';
      sizeLabel.appendChild(document.createTextNode('Filas por página '));
      var size = document.createElement('select');
      size.id = 'importPreviewPageSize';
      [50, 100, 250, 500, 1000].forEach(function (amount) {
        var option = document.createElement('option');
        option.value = String(amount);
        option.textContent = String(amount);
        if (amount === 100) option.selected = true;
        size.appendChild(option);
      });
      size.addEventListener('change', function () {
        if (!ui.importSession) return;
        ui.importSession.previewPageSize = Number(size.value) || 100;
        ui.importSession.previewPage = 1;
        ui.renderImportAssistant();
      });
      sizeLabel.appendChild(size);

      pager.append(first, previous, page, next, last, sizeLabel);
      summary.append(copy, pager);
      preview.parentNode.insertBefore(summary, preview);
    }
    return summary;
  }

  function resetPreviewPosition(session) {
    var signature = session.sheetName + '::' + String(session.headerIndex);
    if (session.previewSignature !== signature) {
      session.previewSignature = signature;
      session.previewPage = 1;
    }
  }

  function renderEntireSheetPreview() {
    var session = ui.importSession;
    var table = document.getElementById('importPreviewTable');
    var summary = ensurePreviewChrome();
    if (!session || !table || !summary) return;

    var rows = session.sheets[session.sheetName] || [];
    var confirm = document.getElementById('importConfirmBtn');
    var headline = document.getElementById('importPreviewHeadline');
    var detail = document.getElementById('importPreviewDetail');
    var pageLabel = document.getElementById('importPreviewPage');
    var pageSizeSelect = document.getElementById('importPreviewPageSize');
    var firstButton = document.getElementById('importPreviewFirst');
    var previousButton = document.getElementById('importPreviewPrevious');
    var nextButton = document.getElementById('importPreviewNext');
    var lastButton = document.getElementById('importPreviewLast');

    if (session.headerIndex == null) {
      headline.textContent = 'Selecciona la fila que contiene los encabezados.';
      detail.textContent = 'La fila seleccionada solo define los nombres de las columnas; no limita las filas que se importarán.';
      table.replaceChildren();
      if (confirm) confirm.textContent = 'Importar datos';
      return;
    }

    resetPreviewPosition(session);
    var importedRows = logic.rowsFromHeader(rows, session.headerIndex);
    var columns = Object.keys(importedRows[0] || {});
    var availableRows = Math.max(0, rows.length - session.headerIndex - 1);
    var ignoredBlankRows = Math.max(0, availableRows - importedRows.length);
    var pageSize = Math.max(1, Number(session.previewPageSize) || 100);
    var totalPages = Math.max(1, Math.ceil(importedRows.length / pageSize));
    var page = Math.max(1, Math.min(totalPages, Number(session.previewPage) || 1));
    session.previewPage = page;
    session.previewPageSize = pageSize;
    session.previewTotalPages = totalPages;

    var start = (page - 1) * pageSize;
    var end = Math.min(importedRows.length, start + pageSize);

    headline.textContent = 'Se importará toda la hoja “' + session.sheetName + '”: ' + formatCount(importedRows.length) + ' filas · ' + formatCount(columns.length) + ' columnas';
    detail.textContent = 'Encabezados: fila ' + (session.headerIndex + 1) + ' · La paginación es solo para revisar la vista previa.' + (ignoredBlankRows ? ' Se omiten ' + formatCount(ignoredBlankRows) + ' filas completamente vacías.' : '');
    pageLabel.textContent = importedRows.length ? ('Filas ' + formatCount(start + 1) + '–' + formatCount(end) + ' de ' + formatCount(importedRows.length) + ' · Página ' + formatCount(page) + ' de ' + formatCount(totalPages)) : 'Sin filas de datos';
    if (pageSizeSelect) pageSizeSelect.value = String(pageSize);

    [firstButton, previousButton].forEach(function (button) { if (button) button.disabled = page <= 1; });
    [nextButton, lastButton].forEach(function (button) { if (button) button.disabled = page >= totalPages || !importedRows.length; });

    table.replaceChildren();
    if (columns.length) {
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
      importedRows.slice(start, end).forEach(function (row, offset) {
        var tr = body.insertRow();
        var numberCell = tr.insertCell();
        numberCell.textContent = formatCount(start + offset + 1);
        columns.forEach(function (column) {
          var cell = tr.insertCell();
          var cellValue = row[column];
          if (cellValue instanceof Date && !Number.isNaN(cellValue.getTime())) {
            cell.textContent = new Intl.DateTimeFormat('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(cellValue);
          } else {
            cell.textContent = cellValue == null ? '' : String(cellValue);
          }
        });
      });
    }

    if (confirm) {
      confirm.disabled = !importedRows.length;
      confirm.textContent = importedRows.length ? ('Importar ' + formatCount(importedRows.length) + ' filas de ' + session.sheetName) : 'Sin datos para importar';
      confirm.title = importedRows.length ? ('Importará las ' + formatCount(importedRows.length) + ' filas con datos de la hoja ' + session.sheetName) : '';
    }
  }

  ui.renderImportAssistant = function () {
    prepareWorkbookSession();
    originalRender();
    renderEntireSheetPreview();
    decorateSheetSelector();
  };
})();
