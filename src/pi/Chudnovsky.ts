import type { PiEngine, PiProgress, PiResult } from './types';
const C3_OVER_24 = 10939058860032000n;

/** Newton's method with a bit-length seed converges in a few iterations, even for 50,000+ digits. */
function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('Cannot take a square root of a negative integer.');
  if (n < 2n) return n;
  const bitLength = n.toString(2).length;
  let x = 1n << BigInt(Math.ceil(bitLength / 2));
  let y = (x + n / x) >> 1n;
  while (y < x) { x = y; y = (x + n / x) >> 1n; }
  return x;
}
interface Split { p: bigint; q: bigint; t: bigint; }

/** Exact integer binary-splitting Chudnovsky calculation (about 14.18 decimal digits per term). */
export class ChudnovskyEngine implements PiEngine {
  calculate(decimalDigits: number, onProgress?: (progress: PiProgress) => void): PiResult {
    if (!Number.isSafeInteger(decimalDigits) || decimalDigits < 1) throw new Error('Digits must be a positive integer.');
    const began = performance.now();
    const terms = Math.ceil((decimalDigits + 12) / 14.181647462725477);
    let completed = 0;
    const report = () => onProgress?.({ iteration: ++completed, totalIterations: terms, elapsedMs: performance.now() - began });
    const split = (a: number, b: number): Split => {
      if (b - a === 1) {
        if (a === 0) { report(); return { p: 1n, q: 1n, t: 13591409n }; }
        const k = BigInt(a);
        const p = (6n * k - 5n) * (2n * k - 1n) * (6n * k - 1n);
        const q = k * k * k * C3_OVER_24;
        const t = p * (13591409n + 545140134n * k);
        report();
        return { p, q, t: a & 1 ? -t : t };
      }
      const middle = (a + b) >> 1;
      const left = split(a, middle);
      const right = split(middle, b);
      return { p: left.p * right.p, q: left.q * right.q, t: left.t * right.q + left.p * right.t };
    };
    const result = split(0, terms);
    const scale = 10n ** BigInt(decimalDigits + 12);
    const pi = (426880n * isqrt(10005n * scale * scale) * result.q) / result.t;
    const raw = pi.toString().padStart(decimalDigits + 13, '0');
    return { digits: raw.slice(0, 1) + raw.slice(1, decimalDigits + 1), iterations: terms, elapsedMs: performance.now() - began };
  }
}
