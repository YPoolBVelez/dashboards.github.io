'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const clientCss = fs.readFileSync(path.join(root, 'client-release.css'), 'utf8');

assert.match(index, /class="brand brand--client"/);
assert.match(index, /class="brand-logo" src="logo-gotas\.png" alt="Gotas Comunicaciones"/);
assert.doesNotMatch(index, /<div class="brand[^>]*>\s*<img[^>]*>\s*<span>GOTAS COMUNICACIONES<\/span>/i);
assert.match(index, /<h1>Panel de Analítica<\/h1>/);
assert.doesNotMatch(index, /<header class="workspace-header"[\s\S]*?<h1>GOTAS COMUNICACIONES<\/h1>/i);
assert.match(clientCss, /\.brand\.brand--client[\s\S]*?background:\s*#0b2748/i, 'COMUNICACIONES debe tener contraste suficiente sobre el fondo del bloque de marca');
assert.match(clientCss, /\.brand--client \.brand-logo[\s\S]*?width:\s*min\(420px,\s*38vw\)[\s\S]*?height:\s*auto/i, 'el logo debe escalar por ancho y mantener su proporción completa');
assert.doesNotMatch(clientCss, /\.brand--client \.brand-logo[\s\S]{0,220}?height:\s*96px/i, 'no debe volver la altura fija que hacía perder proporción al logo');

assert.doesNotMatch(index, /ypoolbvelez\.github\.io/i, 'el frontend no debe quedar acoplado al dominio temporal de GitHub Pages');
assert.doesNotMatch(index, /\/dashboards\.github\.io\//i, 'el frontend no debe usar una ruta base fija de GitHub Pages');
assert.match(index, /href="styles\.css"/);
assert.match(index, /src="src\/app-standalone\.js"/);
assert.ok(fs.existsSync(path.join(root, 'DEPLOYMENT.md')), 'debe existir la guía de despliegue a dominio');

console.log('branding.test.cjs OK');
