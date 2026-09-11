# Despliegue del Dashboard de Gotas Comunicaciones

El proyecto es una aplicación web estática: no necesita compilación ni servidor Node en producción. Todos los recursos propios usan rutas relativas, por lo que el mismo paquete puede publicarse en GitHub Pages, en la raíz de un dominio, en un subdominio o en una carpeta de cPanel.

## Opción recomendada: subdominio del cliente

Ejemplo de destino: `dashboard.dominio-del-cliente.cl`.

1. Crear el subdominio desde el proveedor DNS o cPanel.
2. Apuntar el document root del subdominio a una carpeta exclusiva, por ejemplo `public_html/dashboard/`.
3. Copiar el contenido del repositorio dentro de esa carpeta, conservando `index.html`, `styles.css`, `client-release.css`, `import-workbook.css`, `logo-gotas.png` y la carpeta `src/`.
4. Activar HTTPS/SSL para el subdominio.
5. Abrir el dominio en una ventana privada y realizar el checklist de validación de esta guía.

No es necesario modificar rutas como `src/app-standalone.js` o `logo-gotas.png`; son relativas y funcionan también fuera de GitHub Pages.

## GitHub Pages con dominio personalizado

Cuando Gotas Comunicaciones confirme el dominio definitivo:

1. Configurar el dominio personalizado en Settings > Pages del repositorio.
2. Crear el registro DNS indicado por GitHub (CNAME para subdominio o registros A/AAAA para dominio raíz).
3. Crear el archivo `CNAME` en la raíz **solo cuando se conozca el dominio definitivo**. El archivo debe contener exclusivamente el hostname, por ejemplo `dashboard.empresa.cl`.
4. Activar `Enforce HTTPS` cuando GitHub valide el DNS.

No se incluye un `CNAME` ahora para evitar dejar un dominio ficticio en producción.

## Checklist antes de entregar al cliente

- El logo de Gotas Comunicaciones aparece una sola vez en el encabezado principal y mantiene buena resolución.
- El sitio abre sin referencias visibles a GitHub Pages ni a rutas `/dashboards.github.io/`.
- Excel con múltiples hojas selecciona correctamente la hoja con más datos y permite cambiar de hoja.
- Se importan todas las filas con datos, aunque la vista previa esté paginada.
- Crear, duplicar, mover y redimensionar visualizaciones funciona.
- Filtros globales y locales funcionan con resultados, cero resultados y valores vacíos.
- Guardar y abrir el proyecto local funciona.
- PDF, Excel, CSV, PNG, PowerPoint y respaldos JSON descargan correctamente.
- La consola del navegador no muestra errores durante el flujo principal.
- La vista se revisa en escritorio y móvil.
- HTTPS está activo en el dominio final.

## Publicación desde cPanel

Para cPanel no se debe subir `node_modules`. El servidor solo necesita servir los archivos estáticos. Si se sube un ZIP, extraerlo de forma que `index.html` quede directamente dentro del document root configurado y no dentro de una carpeta anidada adicional.
