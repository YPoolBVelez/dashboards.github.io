/* Centro de exportación del Dashboard Builder. */
(function () {
  'use strict';

  var root = document.querySelector('.export-menu');
  var button = document.getElementById('topExportBtn');
  if (!root || !button) return;

  var isOpen = false, menu = null, closeTimer = null, scriptPromises = Object.create(null);
  var items = [
    { id:'pdf', label:'📄 Informe PDF' },
    { id:'excel', label:'📗 Excel completo' },
    { id:'csv', label:'🧾 CSV datos activos' },
    { id:'png-dashboard', label:'🖼️ PNG del dashboard' },
    { id:'png-visual', label:'📊 PNG visual activa' },
    { id:'pptx', label:'📽️ PowerPoint' },
    { id:'json-data', label:'🧩 JSON de datos' },
    { id:'json-project', label:'💾 Respaldo del proyecto' }
  ];

  function state() { return window.dashboardState || { rawData:[], filteredData:[], visuals:[], globalFilters:[] }; }
  function sourceName() { var node = document.getElementById('loadedFileName'), value = node ? String(node.textContent || '').trim() : ''; if (!value || value === 'Sin archivo cargado') return 'dashboard'; return value.split(' · ')[0].replace(/\.[^.]+$/, '') || 'dashboard'; }
  function safeName(value) { return String(value || 'dashboard').replace(/[<>:"/\\|?*]+/g, '').trim().replace(/\s+/g, '_') || 'dashboard'; }
  function datedName(suffix) { return safeName(sourceName()) + '_' + new Date().toISOString().slice(0,10) + suffix; }

  function download(blob, filename) {
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(link.href); }, 500);
  }

  function csvCell(value) { var valueText = value == null ? '' : (value instanceof Date ? value.toISOString() : String(value)); return '"' + valueText.replace(/"/g, '""') + '"'; }
  function rowsToCsv(rows, fallbackKeys) { var keys = Object.keys(rows[0] || {}); if (!keys.length) keys = fallbackKeys || []; if (!keys.length) return ''; return [keys.map(csvCell).join(',')].concat(rows.map(function (row) { return keys.map(function (key) { return csvCell(row[key]); }).join(','); })).join('\r\n'); }

  /* filteredData puede ser [] legítimamente si un filtro no devuelve filas. Nunca hacemos fallback a rawData por longitud. */
  function activeRows() { var s = state(); return Array.isArray(s.filteredData) ? s.filteredData : (s.rawData || []); }

  function projectSnapshot() {
    var s = state();
    return {
      rawData: JSON.parse(JSON.stringify(s.rawData || [])),
      visuals: JSON.parse(JSON.stringify(s.visuals || [])),
      globalFilters: JSON.parse(JSON.stringify(s.globalFilters || [])),
      activeVisualId: s.activeVisualId || null,
      sourceLabel: s.sourceLabel || (document.getElementById('loadedFileName') || {}).textContent || ''
    };
  }

  function visualResult(visual) {
    try { if (window.dashboardQueryEngine && typeof window.dashboardQueryEngine.execute === 'function') return window.dashboardQueryEngine.execute(visual); }
    catch (error) { console.warn('No fue posible calcular la visualización para exportarla:', error); }
    return null;
  }

  function uniqueSheetName(book, proposed) {
    var clean = String(proposed || 'Hoja').replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0,31) || 'Hoja', names = book.SheetNames || [];
    if (names.indexOf(clean) === -1) return clean;
    var i = 2, base = clean.slice(0,27); while (names.indexOf((base + ' ' + i).slice(0,31)) !== -1) i++; return (base + ' ' + i).slice(0,31);
  }

  function exportExcel() {
    if (!window.XLSX) throw new Error('La librería de Excel no está disponible.');
    var s = state(), book = XLSX.utils.book_new(), rows = activeRows();
    var summary = [
      ['Dashboard', sourceName()], ['Exportado', new Date().toLocaleString('es-CL')],
      ['Registros originales', (s.rawData || []).length], ['Registros activos', rows.length],
      ['Visualizaciones', (s.visuals || []).length], ['Filtros globales', (s.globalFilters || []).length]
    ];
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(summary), 'Resumen');
    var activeSheet = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([Object.keys((s.rawData || [])[0] || {})]);
    XLSX.utils.book_append_sheet(book, activeSheet, 'Datos activos');
    if ((s.rawData || []).length) XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(s.rawData), 'Datos originales');
    (s.visuals || []).forEach(function (visual, index) {
      var result = visualResult(visual), tableRows = result && result.dataset && result.dataset.tableRows;
      if (!tableRows || !tableRows.length) return;
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(tableRows), uniqueSheetName(book, (index + 1) + ' ' + (visual.title || 'Visual')));
    });
    XLSX.writeFile(book, datedName('_dashboard.xlsx'));
  }

  function exportCsv() {
    var s = state(), rows = activeRows(), keys = Object.keys((s.rawData || [])[0] || {}), csv = rowsToCsv(rows, keys);
    if (!csv) throw new Error('No hay columnas disponibles para exportar.');
    download(new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8' }), datedName('_datos.csv'));
  }

  function exportJsonData() {
    var s = state(), payload = { exportedAt:new Date().toISOString(), source:sourceName(), rows:activeRows(), globalFilters:s.globalFilters || [] };
    download(new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' }), datedName('_datos.json'));
  }

  function exportProject() {
    var payload = projectSnapshot();
    payload.exportMetadata = { format:'dashboard-builder-project', version:2, exportedAt:new Date().toISOString(), source:sourceName() };
    download(new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' }), datedName('_proyecto.dashboard.json'));
  }

  function loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    if (scriptPromises[src]) return scriptPromises[src];
    scriptPromises[src] = new Promise(function (resolve, reject) {
      var script = document.createElement('script'); script.src = src; script.async = true;
      script.onload = function () { if (!globalName || window[globalName]) resolve(globalName ? window[globalName] : true); else reject(new Error('La dependencia cargó, pero no expuso ' + globalName + '.')); };
      script.onerror = function () { reject(new Error('No fue posible cargar una dependencia de exportación. Revisa tu conexión a Internet.')); };
      document.head.appendChild(script);
    });
    return scriptPromises[src];
  }

  async function ensureHtml2Canvas() { if (window.html2canvas) return window.html2canvas; return loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas'); }

  async function withExportMode(task) {
    document.body.classList.add('is-exporting');
    try { await new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); }); return await task(); }
    finally { document.body.classList.remove('is-exporting'); }
  }

  async function captureElement(element) {
    if (!element) throw new Error('No se encontró el contenido que se quiere exportar.');
    var html2canvas = await ensureHtml2Canvas();
    return withExportMode(function () {
      return html2canvas(element, { backgroundColor:'#f6f8fc', scale:Math.min(2.5, Math.max(2, window.devicePixelRatio || 1)), useCORS:true, logging:false, windowWidth:Math.max(document.documentElement.clientWidth, element.scrollWidth), windowHeight:Math.max(document.documentElement.clientHeight, element.scrollHeight) });
    });
  }

  async function exportDashboardPng() {
    var workspace = document.getElementById('workspace'), canvas = await captureElement(workspace);
    await new Promise(function (resolve, reject) { canvas.toBlob(function (blob) { if (!blob) return reject(new Error('No fue posible generar la imagen PNG.')); download(blob, datedName('_dashboard.png')); resolve(); }, 'image/png', 1); });
  }

  async function activeVisualDataUrl() {
    var s = state(), activeId = s.activeVisualId, ui = window.__APP__ && window.__APP__.ui, chart = ui && ui.charts && typeof ui.charts.get === 'function' ? ui.charts.get(activeId) : null;
    if (chart && typeof chart.getDataURL === 'function') return chart.getDataURL({ type:'png', pixelRatio:2.5, backgroundColor:'#ffffff' });
    var card = activeId ? document.querySelector('[data-visual-id="' + CSS.escape(activeId) + '"]') : null;
    if (!card) card = document.querySelector('#dashboardCanvas .visual-card');
    var canvas = await captureElement(card); return canvas.toDataURL('image/png', 1);
  }

  async function exportVisualPng() {
    var dataUrl = await activeVisualDataUrl(), link = document.createElement('a'); link.href = dataUrl; link.download = datedName('_visual.png'); document.body.appendChild(link); link.click(); link.remove();
  }

  function imageBox(canvas, maxW, maxH) {
    var ratio = canvas.width / Math.max(1, canvas.height), w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    return { w:w, h:h, x:(13.33 - w) / 2, y:1.3 + (maxH - h) / 2 };
  }

  async function exportPowerPoint() {
    await loadScript('https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', 'PptxGenJS');
    var s = state(), visuals = s.visuals || [];
    if (!visuals.length || !(s.rawData || []).length) throw new Error('No hay visualizaciones con datos para incluir en PowerPoint.');
    var pptx = new window.PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Gotas Comunicaciones'; pptx.company = 'Gotas Comunicaciones'; pptx.subject = 'Dashboard de analítica'; pptx.title = sourceName(); pptx.lang = 'es-CL';
    var cover = pptx.addSlide(); cover.background = { color:'F8FAFC' };
    cover.addText('Informe de Dashboard', { x:.8, y:1.6, w:11.7, h:.7, fontFace:'Aptos', fontSize:28, bold:true, color:'111827' });
    cover.addText(sourceName(), { x:.8, y:2.45, w:11.7, h:.45, fontFace:'Aptos', fontSize:17, color:'4F46E5' });
    cover.addText('Generado el ' + new Date().toLocaleString('es-CL') + ' · ' + (s.rawData || []).length + ' registros · ' + visuals.length + ' visualizaciones', { x:.8, y:3.05, w:11.7, h:.4, fontFace:'Aptos', fontSize:11, color:'64748B' });
    cover.addText('GOTAS COMUNICACIONES', { x:.8, y:6.7, w:4.5, h:.3, fontFace:'Aptos', fontSize:9, bold:true, color:'64748B', charSpacing:1.3 });

    for (var i = 0; i < visuals.length; i++) {
      var visual = visuals[i], card = document.querySelector('[data-visual-id="' + CSS.escape(visual.id) + '"]'); if (!card) continue;
      var canvas = await captureElement(card), data = canvas.toDataURL('image/png', 1), box = imageBox(canvas, 12, 5.55), slide = pptx.addSlide(); slide.background = { color:'FFFFFF' };
      slide.addText(visual.title || ('Visualización ' + (i + 1)), { x:.65, y:.35, w:12, h:.45, fontFace:'Aptos', fontSize:20, bold:true, color:'111827' });
      if (visual.subtitle) slide.addText(visual.subtitle, { x:.65, y:.85, w:12, h:.3, fontFace:'Aptos', fontSize:10, color:'64748B' });
      slide.addImage({ data:data, x:box.x, y:box.y, w:box.w, h:box.h, altText:visual.title || 'Visualización del dashboard' });
      slide.addText('GOTAS COMUNICACIONES', { x:.65, y:7.08, w:3.2, h:.22, fontFace:'Aptos', fontSize:7, color:'94A3B8' });
      slide.addText(String(i + 1) + ' / ' + String(visuals.length), { x:11.8, y:7.08, w:.85, h:.22, align:'right', fontFace:'Aptos', fontSize:7, color:'94A3B8' });
    }
    await pptx.writeFile({ fileName:datedName('_presentacion.pptx'), compression:true });
  }

  async function runExport(kind) {
    var s = state();
    if (!(s.rawData || []).length && kind !== 'json-project') throw new Error('Carga datos antes de exportar.');
    if (kind === 'pdf') { if (!window.GotasPdfReport) throw new Error('El generador de informes PDF no está disponible.'); return window.GotasPdfReport.download(); }
    if (kind === 'excel') return exportExcel();
    if (kind === 'csv') return exportCsv();
    if (kind === 'png-dashboard') return exportDashboardPng();
    if (kind === 'png-visual') return exportVisualPng();
    if (kind === 'pptx') return exportPowerPoint();
    if (kind === 'json-data') return exportJsonData();
    if (kind === 'json-project') { if (!(s.rawData || []).length) throw new Error('No hay un proyecto para respaldar.'); return exportProject(); }
  }

  function positionMenu() { if (!menu) return; menu.classList.remove('export-menu--above'); var box = menu.getBoundingClientRect(); if (box.bottom > window.innerHeight - 8 && button.getBoundingClientRect().top > box.height + 8) menu.classList.add('export-menu--above'); }
  function removeMenu() { if (menu) menu.remove(); menu = null; isOpen = false; closeTimer = null; button.setAttribute('aria-expanded', 'false'); }
  function closeMenu() { if (!menu || !isOpen) return; isOpen = false; button.setAttribute('aria-expanded', 'false'); menu.classList.remove('export-menu--enter'); menu.classList.add('export-menu--leave'); closeTimer = setTimeout(removeMenu, 160); }

  function openMenu() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    if (menu) { isOpen = true; button.setAttribute('aria-expanded', 'true'); menu.classList.remove('export-menu--leave'); menu.classList.add('export-menu--enter'); return; }
    isOpen = true; button.setAttribute('aria-expanded', 'true'); menu = document.createElement('div'); menu.className = 'export-options'; menu.id = 'exportOptions'; menu.setAttribute('role', 'menu');
    items.forEach(function (item) {
      var option = document.createElement('button'); option.type = 'button'; option.setAttribute('role', 'menuitem'); option.textContent = item.label;
      option.addEventListener('click', async function () {
        closeMenu(); button.disabled = true; button.textContent = '⏳ Exportando…';
        try { await runExport(item.id); }
        catch (error) { console.error('Error de exportación:', error); window.alert('No fue posible exportar. ' + (error && error.message ? error.message : 'Error desconocido.')); }
        finally { button.disabled = false; button.textContent = '📤 Exportar'; }
      });
      menu.appendChild(option);
    });
    root.appendChild(menu); positionMenu(); requestAnimationFrame(function () { if (menu) menu.classList.add('export-menu--enter'); });
  }

  button.addEventListener('click', function () { if (isOpen) closeMenu(); else openMenu(); });
  document.addEventListener('pointerdown', function (event) { if (isOpen && !root.contains(event.target)) closeMenu(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', positionMenu);
})();
