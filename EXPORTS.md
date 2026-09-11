# Exportaciones del Dashboard Builder

El centro de exportación soporta:

- **Informe PDF** generado directamente con jsPDF e incluyendo filtros y visualizaciones.
- **Excel multipestaña** con resumen, datos activos, datos originales y hojas agregadas por visualización.
- **CSV UTF-8** de los datos activos del dashboard.
- **PNG del dashboard completo**.
- **PNG de la visualización activa**.
- **PowerPoint (.pptx)** con portada y una diapositiva por visualización.
- **JSON de datos** con filas y filtros globales.
- **Respaldo completo del proyecto** en JSON.

## Restaurar un proyecto

Los respaldos completos son reutilizables. Usa **Cargar datos** y selecciona el archivo `*_proyecto.dashboard.json`; el sistema restaura datos, visualizaciones, posiciones, filtros, métricas, ejes y formatos.

## Persistencia local

El botón **Guardar** usa IndexedDB del navegador. Esto permite proyectos más grandes que `localStorage` y evita el límite habitual de pocos megabytes. Para mover el proyecto a otro navegador o computador, usa el respaldo JSON.

Las dependencias de captura de pantalla, jsPDF y PowerPoint se cargan bajo demanda para mantener liviana la carga inicial de GitHub Pages.
