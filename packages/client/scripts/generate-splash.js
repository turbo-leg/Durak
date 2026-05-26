#!/usr/bin/env node
/**
 * generate-splash.js
 *
 * Documents how to create the 2732x2732 splash screen PNG required by
 * @capacitor/assets for iOS and Android.
 *
 * This script cannot generate the final PNG automatically without a design
 * tool or heavy native dependency (canvas + image compositing), so it prints
 * clear instructions and writes a reference SVG that can be used as a starting
 * point in Figma, Inkscape, or any SVG-capable editor.
 *
 * DESIGN SPEC
 * -----------
 * Canvas:     2732 x 2732 px
 * Background: #1e1b4b  (Tailwind indigo-950)
 * Logo:       White spade (♠) — 1200px wide, centred
 * Wordmark:   "DURAK" in serif bold, white, ~160px, centred below spade
 * Safe zone:  Keep all content within the inner 50% (1366x1366) so nothing
 *             is clipped when the OS crops the splash on different device sizes.
 *
 * STEPS TO PRODUCE splash.png
 * ---------------------------
 * 1. Open splash.svg (written by this script) in Figma or Inkscape.
 * 2. Export at 2732 x 2732 as PNG.
 * 3. Save to packages/client/resources/splash.png.
 * 4. Run: npx @capacitor/assets generate
 *
 * ALTERNATIVE (Inkscape CLI):
 *   inkscape splash.svg --export-png=splash.png -w 2732 -h 2732
 *
 * ALTERNATIVE (ImageMagick):
 *   convert -size 2732x2732 xc:'#1e1b4b' \
 *     -gravity center -fill white -font Georgia-Bold \
 *     -pointsize 400 -annotate 0 '♠' \
 *     -pointsize 160 -annotate +0+700 'DURAK' \
 *     splash.png
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESOURCES_DIR = resolve(__dirname, '../resources');
const SIZE = 2732;
const BG = '#1e1b4b';
const FG = '#ffffff';

// Spade path on a 100x100 viewBox (same as the icon script)
const SPADE_PATH =
  'M50 5 ' +
  'C50 5 10 30 10 55 ' +
  'C10 72 25 82 38 78 ' +
  'C33 88 28 92 20 95 ' +
  'L80 95 ' +
  'C72 92 67 88 62 78 ' +
  'C75 82 90 72 90 55 ' +
  'C90 30 50 5 50 5 Z';

// Scale the 100x100 path to 1200px width (scale=12), centred on 2732x2732
// Centred X offset: (2732 - 1200) / 2 = 766
// Centred Y offset: (2732 / 2) - 900 = 466  (place spade in the upper-centre half)
const SPADE_SCALE = 12;
const SPADE_OFFSET_X = (SIZE - 100 * SPADE_SCALE) / 2; // 766
const SPADE_OFFSET_Y = SIZE / 2 - 900; // 466

const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Durak splash screen — 2732x2732 reference SVG.
  Export this file to PNG at 2732x2732 and save as resources/splash.png.
-->
<svg xmlns="http://www.w3.org/2000/svg"
     width="${SIZE}" height="${SIZE}"
     viewBox="0 0 ${SIZE} ${SIZE}">

  <!-- Background -->
  <rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>

  <!-- Spade symbol (~1200px wide, centred horizontally, upper-centre vertically) -->
  <g transform="translate(${SPADE_OFFSET_X}, ${SPADE_OFFSET_Y}) scale(${SPADE_SCALE})">
    <path d="${SPADE_PATH}" fill="${FG}"/>
  </g>

  <!-- Wordmark -->
  <text
    x="${SIZE / 2}"
    y="${SIZE / 2 + 600}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="200"
    font-weight="bold"
    fill="${FG}"
    text-anchor="middle"
    letter-spacing="30"
    opacity="0.92">DURAK</text>

  <!-- Safe-zone guide (remove before export) -->
  <!--
  <rect
    x="${SIZE * 0.25}" y="${SIZE * 0.25}"
    width="${SIZE * 0.5}" height="${SIZE * 0.5}"
    fill="none" stroke="red" stroke-width="4" stroke-dasharray="20,20" opacity="0.3"/>
  -->
</svg>
`;

mkdirSync(RESOURCES_DIR, { recursive: true });

const svgOut = resolve(RESOURCES_DIR, 'splash.svg');
writeFileSync(svgOut, svgContent, 'utf8');
console.log(`✓ Written splash reference SVG: ${svgOut}`);
console.log('');
console.log('Next steps:');
console.log('  1. Export splash.svg at 2732x2732 PNG → resources/splash.png');
console.log('  2. Run: npx @capacitor/assets generate');
console.log('');
console.log('Inkscape one-liner:');
console.log('  inkscape resources/splash.svg --export-png=resources/splash.png -w 2732 -h 2732');
