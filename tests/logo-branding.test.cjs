'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'client-release.css'), 'utf8');

assert.match(index, /<img class="brand-logo"[^>]*width="600"[^>]*height="133"/i, 'se deben conservar las dimensiones intrínsecas del logo');
assert.match(css, /\.brand\.brand--client[\s\S]*?background:\s*#0b2748/i, 'el texto blanco COMUNICACIONES requiere contraste oscuro');
assert.match(css, /\.brand--client \.brand-logo[\s\S]*?width:\s*min\(420px,\s*38vw\)[\s\S]*?height:\s*auto/i, 'el logo debe mantener su proporción y mostrar el nombre completo');

console.log('logo-branding.test.cjs OK');
