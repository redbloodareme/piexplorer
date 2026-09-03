# Pi Explorer

Pi Explorer is a lightweight, static, browser-based laboratory for calculating and exploring real digits of π. It uses TypeScript, Canvas, and a module Web Worker—no framework or desktop shell is required.

## Architecture

- `src/pi/Chudnovsky.ts` is a `BigInt` integer implementation of Chudnovsky; floating-point `Number` is never used to calculate π digits.
- `src/workers/pi.worker.ts` performs calculation off the UI thread, reports genuine iteration progress, and returns calculated digits in bounded chunks.
- `src/search/search.ts` searches calculated digit data directly. Normal and letter modes use overlapping string search; pixel modes search the underlying row-major data, not a canvas screenshot.
- `src/pixel/PixelRenderer.ts` renders only the Canvas viewport, supports wheel zoom and pointer panning, and outlines selected results.

## Calculation and controls

Chudnovsky contributes about 14.18 decimal digits per term. Progress uses the actual completed term count. The speed slider only changes the worker's **real result chunk size**; it never alters precision. Start creates a worker, Stop terminates it, Reset clears application state, and Pause explicitly pauses visualization while the worker continues calculation safely.

The hard limit is 1,000,000 decimal digits. Values above 100,000 prompt with a conservative memory/work warning. This keeps accidental allocations bounded; the limit can be made configurable later.

## Modes and searches

- **Normal Pi** displays `3.` separately and highlights only matching calculated decimal digits in orange. Export creates `pi-digits.txt`.
- **Number → Letter** reads digit pairs: `01`–`26` are A–Z, values above 26 wrap cyclically, and `00` is a space. The selectable output supports text search and export.
- **Number → Pixel** maps digits to the deterministic palette `#000000, #172B8F, #5C7BC7, #4FA3D1, #00D95A, #FFE500, #FFB900, #F28C00, #F0180D, #F020E8`. Build a color/digit sequence and search exact underlying digits.
- **Two-color Pixel** maps 0–4 to black and 5–9 to white. Draw a small grid; each grid cell is matched as that exact digit range against row-major Pi pixels.

Pixel coordinates are deterministic: index `i` maps to `x = i mod width`, `y = floor(i / width)`. Pixel exports are intentionally unavailable.

## Performance

Large digit strings are retained once in memory, Worker results are chunked, no per-digit DOM nodes are created, and the Canvas renders only its visible rectangle. Search results are capped at 100 to keep navigation responsive.

## Development

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

The Vite production build is a static application suitable for hosting offline after dependencies are installed.
