/* Centro de exportación del Dashboard Builder. */
(function () {
  'use strict';

  var root = document.querySelector('.export-menu');
  var button = document.getElementById('topExportBtn');
  if (!root || !button) return;

  var isOpen = false;
  var menu = null;
  var closeTimer = null;
  var scriptPromises = Object.create(null);

  var items = [
    { id: 'pdf', label: '📄 Informe PDF' },
    { id: 'excel', label: '📗 Excel completo' },
    { id: 'csv', label: '🧾 CSV datos activos' },
    { id: 'png-dashboard', label: '🖼️ PNG del dashboard' },
    { id: 'png-visual', label: '📊 PNG visual activa' },
    { id: 'pptx', label: '📽️ PowerPoint' },
    { id: 'json-data', label: '🧩 JSON de datos' },
    { id: 'json-project', label: '💾 Respaldo del proyecto' }
  ];

  function state() {
    return window.dashboardState || { rawData: [], filteredData: [], visuals: [], globalFilters: [] };
  }

  function sourceName() {
    var node = document.getElementById('loadedFileName');
    var value = node ? String(node.textContent || '').trim() : '';
    if (!value || value === 'Sin archivo cargado') return 'dashboard';
    return value.split(' · ')[0].replace(/\.[^.]+$/, '') || 'dashboard';
  }

  function safeName(value) {
    return String(value || 'dashboard')
      .replace(/[<>:"/\\|?*]+/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'dashboard';
  }

  function datedName(suffix) {
    return safeName(sourceName()) + '_' + new Date().toISOString().slice(0, 10) + suffix;
  }

  function download(blob, filename) {
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 500);
  }

  function csvCell(value) {
    var text = value == null ? '' : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function rowsToCsv(rows) {
    var keys = Object.keys(rows[0] || {});
    if (!keys.length) return '';
    return [keys.map(csvCell).join(',')].concat(rows.map(function (row) {
      return keys.map(function (key) { return csvCell(row[key]); }).join(',');
    })).join('\r\n');
  }

  function activeRows() {
    var s = state();
    return (s.filteredData && s.filteredData.length ? s.filteredData : s.rawData) || [];
  }

  function visualResult(visual) {
    try {
      if (window.dashboardQueryEngine && typeof window.dashboardQueryEngine.execute === 'function') {
        return window.dashboardQueryEngine.execute(visual);
      }
    } catch (error) {
      console.warn('No fue posible calcular la visualización para exportarla:', error);
    }
    return null;
  }

  function uniqueSheetName(book, proposed) {
    var clean = String(proposed || 'Hoja').replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Hoja';
    var names = book.SheetNames || [];
    if (names.indexOf(clean) === -1) return clean;
    var i = 2;
    var base = clean.slice(0, 27);
    while (names.indexOf((base + ' ' + i).slice(0, 31)) !== -1) i++;
    return (base + ' ' + i).slice(0, 31);
  }

  function exportExcel() {
    if (!window.XLSX) throw new Error('La librería de Excel no está disponible.');
    var s = state();
    var book = XLSX.utils.book_new();
    var rows = activeRows();
    var summary = [
      ['Dashboard', sourceName()],
      ['Exportado', new Date().toLocaleString('es-CL')],
      ['Registros originales', (s.rawData || []).length],
      ['Registros activos', rows.length],
      ['Visualizaciones', (s.visuals || []).length],
      ['Filtros globales', (s.globalFilters || []).length]
    ];
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(summary), 'Resumen');
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Datos activos');
    if ((s.rawData || []).length) XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(s.rawData), 'Datos originales');

    (s.visuals || []).forEach(function (visual, index) {
      var result = visualResult(visual);
      var tableRows = result && result.dataset && result.dataset.tableRows;
      if (!tableRows || !tableRows.length) return;
      var name = uniqueSheetName(book, (index + 1) + ' ' + (visual.title || 'Visual'));
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(tableRows), name);
    });

    XLSX.writeFile(book, datedName('_dashboard.xlsx'));
  }

  function exportCsv() {
    var rows = activeRows();
    if (!rows.length) throw new Error('No hay datos disponibles para exportar.');
    var csv = '\ufeff' + rowsToCsv(rows);
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), datedName('_datos.csv'));
  }

  function exportJsonData() {
    var s = state();
    var payload = {
      exportedAt: new Date().toISOString(),
      source: sourceName(),
      rows: activeRows(),
      globalFilters: s.globalFilters || []
    };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }), datedName('_datos.json'));
  }

  function exportProject() {
    var s = state();
    var payload = JSON.parse(JSON.stringify(s));
    payload.exportMetadata = {
      format: 'dashboard-builder-project',
      version: 1,
      exportedAt: new Date().toISOString(),
      source: sourceName()
    };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }), datedName('_proyecto.dashboard.json'));
  }

  function loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    if (scriptPromises[src]) return scriptPromises[src];
    scriptPromises[src] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () {
        if (!globalName || window[globalName]) resolve(globalName ? window[globalName] : true);
        else reject(new Error('La dependencia cargó, pero no expuso ' + globalName + '.'));
      };
      script.onerror = function () { reject(new Error('No fue posible cargar una dependencia de exportación.')); };
      document.head.appendChild(script);
    });
    return scriptPromises[src];
  }

  async function ensureHtml2Canvas() {
    if (window.html2canvas) return window.html2canvas;
    return loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas');
  }

  async function captureElement(element) {
    if (!element) throw new Error('No se encontró el contenido que se quiere exportar.');
    var html2canvas = await ensureHtml2Canvas();
    return html2canvas(element, {
      backgroundColor: '#f6f8fc',
      scale: Math.min(2.5, Math.max(2, window.devicePixelRatio || 1)),
      useCORS: true,
      logging: false,
      windowWidth: Math.max(document.documentElement.clientWidth, element.scrollWidth),
      windowHeight: Math.max(document.documentElement.clientHeight, element.scrollHeight)
    });
  }

  async function exportDashboardPng() {
    var workspace = document.getElementById('workspace');
    var canvas = await captureElement(workspace);
    canvas.toBlob(function (blob) {
      if (!blob) return window.alert('No fue posible generar la imagen PNG.');
      download(blob, datedName('_dashboard.png'));
    }, 'image/png', 1);
  }

  async function activeVisualDataUrl() {
    var s = state();
    var activeId = s.activeVisualId;
    var ui = window.__APP__ && window.__APP__.ui;
    var chart = ui && ui.charts && typeof ui.charts.get === 'function' ? ui.charts.get(activeId) : null;
    if (chart && typeof chart.getDataURL === 'function') {
      return chart.getDataURL({ type: 'png', pixelRatio: 2.5, backgroundColor: '#ffffff' });
    }
    var card = activeId ? document.querySelector('[data-visual-id="' + CSS.escape(activeId) + '"]') : null;
    if (!card) card = document.querySelector('#dashboardCanvas .visual-card');
    var canvas = await captureElement(card);
    return canvas.toDataURL('image/png', 1);
  }

  async function exportVisualPng() {
    var dataUrl = await activeVisualDataUrl();
    var link = document.createElement('a');
    link.href = dataUrl;
    link.download = datedName('_visual.png');
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function exportPowerPoint() {
    await loadScript('https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', 'PptxGenJS');
    var s = state();
    var visuals = s.visuals || [];
    if (!visuals.length) throw new Error('No hay visualizaciones para incluir en PowerPoint.');

    var pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Gotas Comunicaciones';
    pptx.company = 'Gotas Comunicaciones';
    pptx.subject = 'Dashboard de analítica';
    pptx.title = sourceName();
    pptx.lang = 'es-CL';

    var cover = pptx.addSlide();
    cover.background = { color: 'F8FAFC' };
    cover.addText('Informe de Dashboard', { x: 0.8, y: 1.6, w: 11.7, h: 0.7, fontFace: 'Aptos', fontSize: 28, bold: true, color: '111827' });
    cover.addText(sourceName(), { x: 0.8, y: 2.45, w: 11.7, h: 0.45, fontFace: 'Aptos', fontSize: 17, color: '4F46E5' });
    cover.addText('Generado el ' + new Date().toLocaleString('es-CL') + ' · ' + (s.rawData || []).length + ' registros · ' + visuals.length + ' visualizaciones', { x: 0.8, y: 3.05, w: 11.7, h: 0.4, fontFace: 'Aptos', fontSize: 11, color: '64748B' });
    cover.addText('GOTAS COMUNICACIONES', { x: 0.8, y: 6.7, w: 4.5, h: 0.3, fontFace: 'Aptos', fontSize: 9, bold: true, color: '64748B', charSpacing: 1.3 });

    for (var i = 0; i < visuals.length; i++) {
      var visual = visuals[i];
      var card = document.querySelector('[data-visual-id="' + CSS.escape(visual.id) + '"]');
      if (!card) continue;
      var canvas = await captureElement(card);
      var data = canvas.toDataURL('image/png', 1);
      var slide = pptx.addSlide();
      slide.background = { color: 'FFFFFF' };
      slide.addText(visual.title || ('Visualización ' + (i + 1)), { x: 0.65, y: 0.35, w: 12.0, h: 0.45, fontFace: 'Aptos', fontSize: 20, bold: true, color: '111827' });
      if (visual.subtitle) slide.addText(visual.subtitle, { x: 0.65, y: 0.85, w: 12.0, h: 0.3, fontFace: 'Aptos', fontSize: 10, color: '64748B' });
      slide.addImage({ data: data, x: 0.65, y: 1.3, w: 12.0, h: 5.6, altText: visual.title || 'Visualización del dashboard' });
      slide.addText('GOTAS COMUNICACIONES', { x: 0.65, y: 7.08, w: 3.2, h: 0.22, fontFace: 'Aptos', fontSize: 7, color: '94A3B8' });
      slide.addText(String(i + 1) + ' / ' + String(visuals.length), { x: 11.8, y: 7.08, w: 0.85, h: 0.22, align: 'right', fontFace: 'Aptos', fontSize: 7, color: '94A3B8' });
    }

    await pptx.writeFile({ fileName: datedName('_presentacion.pptx'), compression: true });
  }

  async function runExport(kind) {
    if (kind === 'pdf') {
      if (!window.GotasPdfReport) throw new Error('El generador de informes PDF no está disponible.');
      return window.GotasPdfReport.download();
    }
    if (kind === 'excel') return exportExcel();
    if (kind === 'csv') return exportCsv();
    if (kind === 'png-dashboard') return exportDashboardPng();
    if (kind === 'png-visual') return exportVisualPng();
    if (kind === 'pptx') return exportPowerPoint();
    if (kind === 'json-data') return exportJsonData();
    if (kind === 'json-project') return exportProject();
  }

  function positionMenu() {
    if (!menu) return;
    menu.classList.remove('export-menu--above');
    var box = menu.getBoundingClientRect();
    if (box.bottom > window.innerHeight - 8 && button.getBoundingClientRect().top > box.height + 8) menu.classList.add('export-menu--above');
  }

  function removeMenu() {
    if (menu) menu.remove();
    menu = null;
    isOpen = false;
    closeTimer = null;
    button.setAttribute('aria-expanded', 'false');
  }

  function closeMenu() {
    if (!menu || !isOpen) return;
    isOpen = false;
    button.setAttribute('aria-expanded', 'false');
    menu.classList.remove('export-menu--enter');
    menu.classList.add('export-menu--leave');
    closeTimer = setTimeout(removeMenu, 160);
  }

  function openMenu() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    if (menu) {
      isOpen = true;
      button.setAttribute('aria-expanded', 'true');
      menu.classList.remove('export-menu--leave');
      menu.classList.add('export-menu--enter');
      return;
    }
    isOpen = true;
    button.setAttribute('aria-expanded', 'true');
    menu = document.createElement('div');
    menu.className = 'export-options';
    menu.id = 'exportOptions';
    menu.setAttribute('role', 'menu');

    items.forEach(function (item) {
      var option = document.createElement('button');
      option.type = 'button';
      option.setAttribute('role', 'menuitem');
      option.textContent = item.label;
      option.addEventListener('click', async function () {
        closeMenu();
        button.disabled = true;
        button.textContent = '⏳ Exportando…';
        try {
          await runExport(item.id);
        } catch (error) {
          console.error('Error de exportación:', error);
          window.alert('No fue posible exportar. ' + (error && error.message ? error.message : 'Error desconocido.'));
        } finally {
          button.disabled = false;
          button.textContent = '📤 Exportar';
        }
      });
      menu.appendChild(option);
    });

    root.appendChild(menu);
    positionMenu();
    requestAnimationFrame(function () { if (menu) menu.classList.add('export-menu--enter'); });
  }

  button.addEventListener('click', function () { if (isOpen) closeMenu(); else openMenu(); });
  document.addEventListener('pointerdown', function (event) { if (isOpen && !root.contains(event.target)) closeMenu(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', positionMenu);
})();
