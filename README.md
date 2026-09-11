# Dashboard Builder — Gotas Comunicaciones

Aplicación web estática para construir dashboards interactivos desde Excel, CSV o respaldos JSON. Todo el procesamiento ocurre en el navegador: los archivos del cliente no se envían a un backend.

## Funcionalidad principal

- Importación guiada de Excel y CSV con detección de encabezados.
- Restauración de respaldos completos `.json`.
- Múltiples visualizaciones redimensionables y movibles.
- Barras, líneas, área, dispersión, pie, dona, radar, tabla y KPI.
- Múltiples métricas por visualización, incluyendo agregaciones estadísticas.
- Eje izquierdo/derecho automático o manual por métrica.
- Gráficos combinados por métrica (barra, línea o puntos).
- Formato por métrica: número, CLP, porcentaje o abreviado.
- Filtros locales y globales con multiselección.
- Ordenamiento y Top N.
- Guardado local en IndexedDB y apertura posterior en el mismo navegador.
- Exportación a PDF, Excel, CSV, PNG, PowerPoint y JSON.

## Arquitectura en producción

La aplicación que se publica desde `index.html` utiliza:

- `src/import-assistant-logic.js`: detección de encabezados y transformación de filas.
- `src/chart-utils.js`: números localizados, formatos, filtros y asignación de ejes.
- `src/app-standalone.js`: estado, agregaciones, renderizado ECharts, importación y persistencia.
- `src/field-builder.js`: configuración de campos, métricas, filtros y propiedades.
- `src/global-filters.js`: controles persistentes de filtros globales.
- `src/pdf-report.js`: generación del informe PDF.
- `src/export-menu.js`: centro de exportaciones.

## Desarrollo local

```powershell
npm ci
npm test
node serve-local.js 8000
```

Luego abre `http://localhost:8000`.

## Calidad

`npm test` valida sintaxis de los archivos productivos y cubre la detección de encabezados, números en formato chileno/internacional, filtros y asignación automática de ejes. GitHub Actions ejecuta estas comprobaciones en cada Pull Request y en cambios a `main`.

## Privacidad y almacenamiento

Los datos se procesan localmente. El botón **Guardar** utiliza IndexedDB del navegador para evitar los límites de tamaño de `localStorage`. Para mover un proyecto a otro equipo o navegador se debe usar **Exportar → Respaldo del proyecto** y luego abrir ese JSON desde **Cargar datos**.
