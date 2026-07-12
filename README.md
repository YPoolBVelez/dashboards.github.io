# Dashboards

Aplicación estática para crear visualizaciones y KPIs desde archivos Excel o CSV. Todo el procesamiento ocurre en el navegador.

## Uso local

```powershell
node serve-local.js 8000
```

Abre `http://localhost:8000`, selecciona un archivo y configura dimensión, métrica, filtros, KPIs y gráfico. También funciona desde un servidor estático compatible con ES modules.

## Arquitectura

`index.html` define la interfaz; `src/main.js` compone la aplicación; `State`, `DataService`, `ChartService` y `UIController` separan estado, lectura, gráficos e interacción. Los dashboards se almacenan en `localStorage`; los archivos no se transmiten a ningún servidor.

## Limitaciones conocidas

Chart.js cubre barras, líneas, circular, pie, radar y área polar. Visualizaciones especializadas (Sankey, treemap, heatmap, candlestick, network y PowerPoint) requieren una biblioteca de gráficos y exportación adicional antes de declararlas compatibles.

## Calidad

Consulta [docs/AUDIT.md](docs/AUDIT.md) para el diagnóstico técnico, prioridades y roadmap.
