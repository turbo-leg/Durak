#!/usr/bin/env node
/**
 * generate-placeholder-icon.js
 *
 * Creates a placeholder app icon for the Durak card game.
 *
 * - If the `canvas` npm package is available it writes a 1024x1024 PNG to
 *   packages/client/resources/icon.png
 * - Otherwise it writes an SVG to packages/client/resources/icon.svg with an
 *   identical design so it can be opened and exported manually.
 *
 * Design: dark purple background (#1e1b4b), white spade symbol centred.
 */

import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESOURCES_DIR = resolve(__dirname, '../resources');
const BG_COLOR = '#1e1b4b';
const FG_COLOR = '#ffffff';
const SIZE = 1024;

// Spade path — centered on a 100x100 viewBox, will be scaled to SIZE.
// The spade body is a classic card-suit spade shape.
const SPADE_PATH =
  'M50 5 ' +
  'C50 5 10 30 10 55 ' +
  'C10 72 25 82 38 78 ' +
  'C33 88 28 92 20 95 ' +
  'L80 95 ' +
  'C72 92 67 88 62 78 ' +
  'C75 82 90 72 90 55 ' +
  'C90 30 50 5 50 5 Z';

// SVG string (used both as the file output and as the canvas source fallback)
const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${SIZE}" height="${SIZE}"
     viewBox="0 0 ${SIZE} ${SIZE}">
  <!-- Background -->
  <rect width="${SIZE}" height="${SIZE}" fill="${BG_COLOR}" rx="${SIZE * 0.12}" ry="${SIZE * 0.12}"/>

  <!-- Spade symbol, scaled to ~60% of the canvas and centred -->
  <!-- viewBox of the path above is 0 0 100 100; we place it in a 614x614 box offset by 205,185 -->
  <g transform="translate(205, 185) scale(6.14)">
    <path d="${SPADE_PATH}" fill="${FG_COLOR}"/>
  </g>

  <!-- "DURAK" wordmark below the spade -->
  <text
    x="${SIZE / 2}"
    y="${SIZE - 80}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="90"
    font-weight="bold"
    fill="${FG_COLOR}"
    text-anchor="middle"
    letter-spacing="12"
    opacity="0.92">DURAK</text>
</svg>
`;

mkdirSync(RESOURCES_DIR, { recursive: true });

// Try to use canvas for a proper PNG output
let canvasAvailable = false;
try {
  const require = createRequire(import.meta.url);
  const { createCanvas } = require('canvas');
  canvasAvailable = true;

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // Background with rounded corners
  const radius = SIZE * 0.12;
  ctx.fillStyle = BG_COLOR;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(SIZE - radius, 0);
  ctx.quadraticCurveTo(SIZE, 0, SIZE, radius);
  ctx.lineTo(SIZE, SIZE - radius);
  ctx.quadraticCurveTo(SIZE, SIZE, SIZE - radius, SIZE);
  ctx.lineTo(radius, SIZE);
  ctx.quadraticCurveTo(0, SIZE, 0, SIZE - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Scale + translate to center the spade path (100x100 viewBox -> 614px, offset 205,185)
  ctx.save();
  ctx.translate(205, 185);
  ctx.scale(6.14, 6.14);
  ctx.fillStyle = FG_COLOR;
  const p = new Path2D(SPADE_PATH);
  ctx.fill(p);
  ctx.restore();

  // Wordmark
  ctx.fillStyle = FG_COLOR;
  ctx.font = `bold 90px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.92;
  ctx.letterSpacing = '12px';
  ctx.fillText('DURAK', SIZE / 2, SIZE - 80);
  ctx.globalAlpha = 1;

  const pngOut = resolve(RESOURCES_DIR, 'icon.png');
  writeFileSync(pngOut, canvas.toBuffer('image/png'));
  console.log(`✓ Written PNG icon: ${pngOut}`);
} catch {
  canvasAvailable = false;
}

if (!canvasAvailable) {
  // Fallback: write SVG only
  const svgOut = resolve(RESOURCES_DIR, 'icon.svg');
  writeFileSync(svgOut, svgContent, 'utf8');
  console.log(`✓ Written SVG icon (canvas not available): ${svgOut}`);
  console.log('');
  console.log('To convert to PNG for @capacitor/assets:');
  console.log('  Option A: Open icon.svg in Figma / Inkscape and export at 1024x1024 PNG');
  console.log('  Option B: Install canvas and re-run:');
  console.log('    npm install canvas --save-dev');
  console.log('    node scripts/generate-placeholder-icon.js');
  console.log('  Option C: Use Inkscape CLI:');
  console.log('    inkscape icon.svg --export-png=icon.png -w 1024 -h 1024');
}
