/* Dropdown de exportación: el menú sólo existe mientras está abierto o cerrando. */
(function () {
  'use strict';
  var root = document.querySelector('.export-menu'), button = document.getElementById('topExportBtn');
  if (!root || !button) return;
  var isExportMenuOpen = false, menu = null, closeTimer = null;
  var items = [{ id: 'pdf', label: 'PDF' }, { id: 'png', label: 'PNG' }, { id: 'excel', label: 'Excel' }, { id: 'csv', label: 'CSV' }, { id: 'pptx', label: 'PowerPoint' }];
  function rowsToCsv(rows) { var keys = Object.keys(rows[0] || {}); return [keys].concat(rows.map(function (row) { return keys.map(function (key) { return JSON.stringify(row[key] == null ? '' : row[key]); }); })).map(function (line) { return line.join(','); }).join('\n'); }
  function download(blob, filename) { var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(function () { URL.revokeObjectURL(link.href); }, 0); }
  function runExport(kind) { var state = window.dashboardState || { filteredData: [] }, rows = state.filteredData || [], chart = window.__APP__ && window.__APP__.ui && window.__APP__.ui.chart; if (kind === 'png') { if (!chart) return; var link = document.createElement('a'); link.href = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0f172a' }); link.download = 'dashboard.png'; link.click(); return; } if (kind === 'csv') return download(new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' }), 'dashboard.csv'); if (kind === 'excel') { if (!window.XLSX) return; var book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Datos'); XLSX.writeFile(book, 'dashboard.xlsx'); return; } if (kind === 'pdf') { if (window.html2pdf) return html2pdf().set({ margin: 10, filename: 'dashboard.pdf', html2canvas: { backgroundColor: '#0f172a' } }).from(document.getElementById('workspace')).save(); return; } window.alert('La exportación PowerPoint estará disponible próximamente.'); }
  // El PDF se construye como informe, no como una captura del espacio de trabajo.
  function runExport(kind) {
    if (kind === 'pdf') {
      if (window.GotasPdfReport) return window.GotasPdfReport.download();
      window.alert('El generador de informes PDF no está disponible.');
      return;
    }
    var state = window.dashboardState || { filteredData: [] }, rows = state.filteredData || [], chart = window.__APP__ && window.__APP__.ui && window.__APP__.ui.chart;
    if (kind === 'png') { if (!chart) return; var link = document.createElement('a'); link.href = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0f172a' }); link.download = 'dashboard.png'; link.click(); return; }
    if (kind === 'csv') return download(new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' }), 'dashboard.csv');
    if (kind === 'excel') { if (!window.XLSX) return; var book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Datos'); XLSX.writeFile(book, 'dashboard.xlsx'); return; }
    window.alert('La exportación PowerPoint estará disponible próximamente.');
  }

  function positionMenu() { if (!menu) return; menu.classList.remove('export-menu--above'); var box = menu.getBoundingClientRect(); if (box.bottom > window.innerHeight - 8 && button.getBoundingClientRect().top > box.height + 8) menu.classList.add('export-menu--above'); }
  function removeMenu() { if (menu) menu.remove(); menu = null; isExportMenuOpen = false; closeTimer = null; button.setAttribute('aria-expanded', 'false'); }
  function closeMenu() { if (!menu || !isExportMenuOpen) return; isExportMenuOpen = false; button.setAttribute('aria-expanded', 'false'); menu.classList.remove('export-menu--enter'); menu.classList.add('export-menu--leave'); closeTimer = setTimeout(removeMenu, 160); }
  function openMenu() { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } if (menu) { isExportMenuOpen = true; button.setAttribute('aria-expanded', 'true'); menu.classList.remove('export-menu--leave'); menu.classList.add('export-menu--enter'); return; } isExportMenuOpen = true; button.setAttribute('aria-expanded', 'true'); menu = document.createElement('div'); menu.className = 'export-options'; menu.id = 'exportOptions'; menu.setAttribute('role', 'menu'); items.forEach(function (item) { var option = document.createElement('button'); option.type = 'button'; option.setAttribute('role', 'menuitem'); option.textContent = item.label; option.addEventListener('click', function () { runExport(item.id); closeMenu(); }); menu.appendChild(option); }); root.appendChild(menu); positionMenu(); requestAnimationFrame(function () { if (menu) menu.classList.add('export-menu--enter'); }); }
  button.addEventListener('click', function () { if (isExportMenuOpen) closeMenu(); else openMenu(); });
  document.addEventListener('pointerdown', function (event) { if (isExportMenuOpen && !root.contains(event.target)) closeMenu(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', positionMenu);
})();
