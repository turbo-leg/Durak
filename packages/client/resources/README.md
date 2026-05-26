# App Assets

This directory contains source assets for generating all required icon and splash screen sizes
for iOS and Android via `@capacitor/assets`.

## Required Files

| File         | Size         | Description                                                               |
| ------------ | ------------ | ------------------------------------------------------------------------- |
| `icon.png`   | 1024x1024 px | App icon — dark purple background (#1e1b4b) with white spade/crown symbol |
| `splash.png` | 2732x2732 px | Splash screen — same dark purple background, centered logo                |

> **Note:** An `icon.svg` placeholder is included. To generate a proper `icon.png`, run:
>
> ```bash
> npm run gen:assets
> ```
>
> The script at `scripts/generate-placeholder-icon.js` will produce the SVG (no external deps).
> For a production-quality PNG, open `icon.svg` in Figma / Inkscape and export at 1024x1024.

## Auto-generating All Platform Sizes

Once `icon.png` and `splash.png` exist, run:

```bash
npx @capacitor/assets generate
```

This generates every required size for iOS (`ios/App/App/Assets.xcassets/...`) and Android
(`android/app/src/main/res/...`) from the two source files.

## Design Spec

- **Background:** `#1e1b4b` (Tailwind `indigo-950`)
- **Symbol:** White spade (♠) or crown, centered, ~60% of canvas width
- **Safe zone:** Keep the symbol within the inner 80% of the canvas so nothing is clipped on
  round icon masks.
- **Splash background:** Same `#1e1b4b`; the logo/symbol should be centered on a 2732x2732 canvas.
