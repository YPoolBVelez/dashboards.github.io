export class ChartService {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error('Canvas not found: ' + canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.chart = null;
  }

  // paletteMap: { labelValue: color }
  createOrUpdate(type, labels, data, label, paletteMap = {}, formatOptions = {}) {
    const background = Array.isArray(data)
      ? labels.map(l => paletteMap[l] || ChartService.defaultColor())
      : ChartService.defaultColor();

    const dataset = {
      label: label || '',
      data,
      backgroundColor: background,
      borderColor: '#60a5fa',
      borderWidth: 1,
    };

    const options = { responsive: true, maintainAspectRatio: false };
    if (formatOptions && formatOptions.format) {
      const fmt = formatOptions.format;
      const total = formatOptions.total || null;
      options.plugins = options.plugins || {};
      options.plugins.tooltip = {
        callbacks: {
          label: function(context) {
            var v = null;
            if (context.parsed && typeof context.parsed === 'object') {
              v = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
            } else {
              v = context.raw !== undefined ? context.raw : context.parsed;
            }
            if (v == null) return '';
            if (fmt === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CLP' }).format(v);
            if (fmt === 'percent' && total) return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(v / total);
            if (fmt === 'number') return new Intl.NumberFormat().format(v);
            if (fmt === 'date') { try { return new Date(v).toLocaleString(); } catch(e){ return String(v); } }
            return String(v);
          }
        }
      };
    }

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    this.chart = new Chart(this.ctx, {
      type,
      data: { labels, datasets: [dataset] },
      options
    });
  }

  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  static defaultColor() { return '#3b82f6'; }

  // Palette utilities
  static palettes() {
    return {
      default: ['#3b82f6','#60a5fa','#1e3a8a','#2563eb','#93c5fd'],
      warm: ['#ef4444','#f97316','#f59e0b','#facc15','#fb923c'],
      cool: ['#06b6d4','#0891b2','#0ea5a0','#5eead4','#0284c7'],
      pastel: ['#ffd6e0','#c7f9cc','#dbe7ff','#fff4cc','#e6e6fa'],
      vibrant: ['#ef476f','#ffd166','#06d6a0','#118ab2','#073b4c']
    };
  }

  static paletteMapForLabels(labels, paletteName) {
    const palettes = ChartService.palettes();
    const arr = palettes[paletteName] || palettes.default;
    const map = {};
    labels.forEach((l, i) => { map[l] = arr[i % arr.length]; });
    return map;
  }
}
