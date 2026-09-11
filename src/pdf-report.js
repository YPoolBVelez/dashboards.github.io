/* Generador de informe ejecutivo PDF. Construye el documento con jsPDF para evitar capturas en blanco. */
(function () {
  'use strict';

  var BRAND = '#182b49', ACCENT = '#14b8a6', TEXT = '#172033', MUTED = '#64748b', BORDER = '#dbe4ee';
  var JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var HTML2CANVAS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

  function value(v) { return String(v == null ? '' : v); }
  function fileName(v) { return value(v).replace(/[<>:"/\\|?*]+/g, '').trim().replace(/\s+/g, '_') || 'Informe_Gotas'; }
  function number(v) { var n = Number(v); return Number.isFinite(n) ? new Intl.NumberFormat('es-CL', { maximumFractionDigits:2 }).format(n) : value(v); }
  function queryText(parent, selector) { var n = parent && parent.querySelector(selector); return n ? n.textContent.trim() : ''; }
  function hexToRgb(hex) { var raw = String(hex || '').replace('#',''); if (raw.length === 3) raw = raw.split('').map(function (x) { return x + x; }).join(''); var n = parseInt(raw,16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function setTextColor(pdf, hex) { var c = hexToRgb(hex); pdf.setTextColor(c[0],c[1],c[2]); }
  function setDrawColor(pdf, hex) { var c = hexToRgb(hex); pdf.setDrawColor(c[0],c[1],c[2]); }
  function setFillColor(pdf, hex) { var c = hexToRgb(hex); pdf.setFillColor(c[0],c[1],c[2]); }

  function loadScript(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = Array.prototype.slice.call(document.scripts).find(function (s) { return s.src === src; });
      if (existing) {
        existing.addEventListener('load', function () { ready() ? resolve() : reject(new Error('La librería no quedó disponible.')); }, { once:true });
        existing.addEventListener('error', function () { reject(new Error('No fue posible cargar una librería de exportación.')); }, { once:true }); return;
      }
      var script = document.createElement('script'); script.src = src; script.async = true;
      script.onload = function () { ready() ? resolve() : reject(new Error('La librería no quedó disponible.')); };
      script.onerror = function () { reject(new Error('No fue posible cargar una librería de exportación. Revisa tu conexión a Internet.')); };
      document.head.appendChild(script);
    });
  }

  async function ensureLibraries() { await loadScript(JSPDF_URL, function () { return !!(window.jspdf && window.jspdf.jsPDF); }); }
  async function ensureHtml2Canvas() { await loadScript(HTML2CANVAS_URL, function () { return typeof window.html2canvas === 'function'; }); }

  function imageSize(dataUrl) { return new Promise(function (resolve) { var image = new Image(); image.onload = function () { resolve({ width:image.naturalWidth || image.width || 1, height:image.naturalHeight || image.height || 1 }); }; image.onerror = function () { resolve({ width:1, height:1 }); }; image.src = dataUrl; }); }
  function logoDataUrl() { return new Promise(function (resolve) { var image = new Image(); image.crossOrigin = 'anonymous'; image.onload = function () { try { var canvas = document.createElement('canvas'); canvas.width = image.naturalWidth || image.width; canvas.height = image.naturalHeight || image.height; canvas.getContext('2d').drawImage(image,0,0); resolve(canvas.toDataURL('image/png')); } catch (e) { resolve(''); } }; image.onerror = function () { resolve(''); }; image.src = 'logo-gotas.png'; }); }

  function chartDataUrl(card) {
    try {
      var id = card && card.dataset && card.dataset.visualId, charts = window.__APP__ && window.__APP__.ui && window.__APP__.ui.charts, chart = id && charts && typeof charts.get === 'function' ? charts.get(id) : null;
      if (chart && typeof chart.getDataURL === 'function') return chart.getDataURL({ type:'png', pixelRatio:2, backgroundColor:'#ffffff' });
      var canvas = card && card.querySelector('canvas'); return canvas ? canvas.toDataURL('image/png',1) : '';
    } catch (e) { return ''; }
  }

  async function fallbackVisualDataUrl(card) {
    await ensureHtml2Canvas(); var target = card.querySelector('.visual-content') || card;
    var canvas = await window.html2canvas(target, { backgroundColor:'#ffffff', scale:2, useCORS:true, logging:false, scrollX:0, scrollY:0 });
    return canvas.toDataURL('image/png',.98);
  }

  function pageHeader(pdf, source, logo) {
    if (logo) { try { pdf.addImage(logo,'PNG',14,11,13,13); } catch (e) {} }
    setTextColor(pdf,BRAND); pdf.setFont('helvetica','bold'); pdf.setFontSize(9); pdf.text('GOTAS COMUNICACIONES', logo ? 31 : 14, 16); pdf.setFontSize(16); pdf.text('Informe ejecutivo de analítica', logo ? 31 : 14, 22);
    setTextColor(pdf,MUTED); pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5); var sourceText = source && source !== 'Sin archivo cargado' ? source : 'Fuente de datos del dashboard'; pdf.text('Fuente: ' + sourceText,14,29,{ maxWidth:182 });
    setDrawColor(pdf,ACCENT); pdf.setLineWidth(.8); pdf.line(14,33,196,33);
  }

  function pageFooter(pdf, page, total) { setDrawColor(pdf,BORDER); pdf.setLineWidth(.25); pdf.line(14,284,196,284); setTextColor(pdf,MUTED); pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.text('GOTAS COMUNICACIONES · Dashboard de Analítica',14,289); pdf.text('Página ' + page + ' de ' + total,196,289,{ align:'right' }); }

  function drawMetric(pdf, x, y, w, label, result) { setFillColor(pdf,'#f8fafc'); setDrawColor(pdf,BORDER); pdf.roundedRect(x,y,w,20,2,2,'FD'); setTextColor(pdf,MUTED); pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5); pdf.text(String(label).toUpperCase(),x+4,y+6); setTextColor(pdf,BRAND); pdf.setFontSize(14); pdf.text(String(result),x+4,y+15); }

  function filterSummary(state) {
    var filters = state.globalFilters || [];
    if (!filters.length) return 'Sin filtros globales aplicados.';
    return filters.map(function (f) {
      var field = f.field || f.name || 'Filtro', vals = Array.isArray(f.values) ? f.values : [];
      if (f.matchNone) return field + ': Ninguno';
      if (!vals.length) return field + ': Todos';
      var shown = vals.slice(0,8).join(', '), remainder = vals.length - 8;
      return field + ': ' + shown + (remainder > 0 ? ' (+' + remainder + ' más)' : '');
    }).join(' · ');
  }

  async function addVisual(pdf, card, index, y) {
    var title = queryText(card,'h2') || ('Visualización ' + (index + 1)), subtitle = queryText(card,'.visual-subtitle'), kpi = card.querySelector('.visual-kpi'), availableWidth = 174;
    setTextColor(pdf,ACCENT); pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5); pdf.text('VISUALIZACIÓN ' + String(index + 1).padStart(2,'0'),18,y+6);
    setTextColor(pdf,BRAND); pdf.setFontSize(12); var titleLines = pdf.splitTextToSize(title,availableWidth); pdf.text(titleLines,18,y+12); var titleHeight = Math.max(6,titleLines.length*5), contentY = y + 12 + titleHeight;
    if (subtitle) { setTextColor(pdf,MUTED); pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5); var subLines = pdf.splitTextToSize(subtitle,availableWidth); pdf.text(subLines,18,contentY); contentY += Math.max(5,subLines.length*4); }
    if (kpi) { setFillColor(pdf,'#f8fafc'); setDrawColor(pdf,BORDER); pdf.roundedRect(18,contentY+2,174,28,2,2,'FD'); setTextColor(pdf,BRAND); pdf.setFont('helvetica','bold'); pdf.setFontSize(22); pdf.text(queryText(kpi,'strong') || '0',105,contentY+15,{ align:'center' }); setTextColor(pdf,MUTED); pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.text(queryText(kpi,'span') || title,105,contentY+23,{ align:'center' }); return contentY + 34; }
    var dataUrl = chartDataUrl(card); if (!dataUrl) { try { dataUrl = await fallbackVisualDataUrl(card); } catch (e) { dataUrl = ''; } }
    if (dataUrl) {
      var size = await imageSize(dataUrl), ratio = size.width / Math.max(1,size.height), imageWidth = availableWidth, imageHeight = imageWidth / ratio;
      if (imageHeight > 92) { imageHeight = 92; imageWidth = imageHeight * ratio; }
      var x = 18 + (availableWidth - imageWidth) / 2;
      try { pdf.addImage(dataUrl,'PNG',x,contentY+2,imageWidth,imageHeight,undefined,'FAST'); } catch (e) { setTextColor(pdf,MUTED); pdf.setFontSize(8); pdf.text('No fue posible insertar la imagen de esta visualización.',18,contentY+10); imageHeight = 14; }
      return contentY + imageHeight + 8;
    }
    setTextColor(pdf,MUTED); pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.text('Esta visualización aún no contiene contenido exportable.',18,contentY+10); return contentY + 18;
  }

  async function download() {
    await ensureLibraries();
    var jsPDF = window.jspdf.jsPDF, state = window.dashboardState || {}, cards = Array.prototype.slice.call(document.querySelectorAll('#dashboardCanvas .visual-card')), rows = Array.isArray(state.filteredData) ? state.filteredData : (state.rawData || []), source = value(document.getElementById('loadedFileName') && document.getElementById('loadedFileName').textContent).trim(), now = new Date(), logo = await logoDataUrl();
    if (!(state.rawData || []).length) throw new Error('No hay datos cargados para generar el informe.');
    var pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true });
    pageHeader(pdf,source,logo); setTextColor(pdf,TEXT); pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5); pdf.text(pdf.splitTextToSize('Este informe consolida los principales resultados del dashboard y respeta los filtros actualmente aplicados.',182),14,41);
    drawMetric(pdf,14,50,56,'Registros analizados',number(rows.length)); drawMetric(pdf,77,50,56,'Visualizaciones',number(cards.length)); drawMetric(pdf,140,50,56,'Filtros globales',number((state.globalFilters || []).length));
    setTextColor(pdf,MUTED); pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5); var filterLines = pdf.splitTextToSize('Filtros: ' + filterSummary(state),182); pdf.text(filterLines,14,78); var y = 84 + Math.max(0,(filterLines.length - 1)*4);
    for (var i=0;i<cards.length;i++) { if (y > 178) { pdf.addPage(); pageHeader(pdf,source,logo); y = 40; } setDrawColor(pdf,BORDER); pdf.setLineWidth(.25); pdf.roundedRect(14,y,182,112,2,2,'S'); var nextY = await addVisual(pdf,cards[i],i,y+2); y = Math.max(y+116,nextY+5); }
    if (!cards.length) { setTextColor(pdf,MUTED); pdf.setFontSize(9); pdf.text('No hay visualizaciones configuradas para incluir en el informe.',14,y+12); }
    var totalPages = pdf.getNumberOfPages(); for (var p=1;p<=totalPages;p++) { pdf.setPage(p); pageFooter(pdf,p,totalPages); }
    pdf.save(fileName(source || 'Informe_Gotas') + '_' + now.toISOString().slice(0,10) + '.pdf');
  }

  window.GotasPdfReport = { download:download };
  ['downloadPdfBtn','builderPdfBtn'].forEach(function (id) { var button = document.getElementById(id); if (!button) return; button.addEventListener('click',async function () { var original = button.textContent; button.disabled = true; button.textContent = 'Generando…'; try { await download(); } catch (error) { console.error('Error al exportar informe PDF:',error); window.alert('No fue posible generar el PDF. ' + error.message); } finally { button.disabled = false; button.textContent = original; } }); });
})();
