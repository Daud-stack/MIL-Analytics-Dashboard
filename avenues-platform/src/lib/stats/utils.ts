/**
 * Statistical utility functions for mathematical operations
 */

/**
 * Compute natural logarithm of gamma function
 * Uses Lanczos approximation for accuracy
 */
export function logGamma(x: number): number {
  const g = 7;
  const coeff = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * x)) - logGamma(1 - x);
  }

  x -= 1;
  let a = coeff[0];
  const t = x + g + 0.5;

  for (let i = 1; i < coeff.length; i++) {
    a += coeff[i] / (x + i);
  }

  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Compute beta function B(x, y) = Gamma(x) * Gamma(y) / Gamma(x + y)
 */
export function betaFunction(x: number, y: number): number {
  return Math.exp(logGamma(x) + logGamma(y) - logGamma(x + y));
}

/**
 * Regularized incomplete beta function I_x(a, b)
 * Used for beta distribution CDF
 */
export function regularizedBeta(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) return x < 0 ? 0 : 1;
  if (x === 0) return 0;
  if (x === 1) return 1;

  const bt =
    Math.exp(
      logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
    ) / a;

  if (x < (a + 1) / (a + b + 2)) {
    return bt * betaCFraction(x, a, b);
  }
  return 1 - bt * betaCFraction(1 - x, b, a);
}

/**
 * Continued fraction for incomplete beta function
 */
function betaCFraction(x: number, a: number, b: number): number {
  const maxIter = 100;
  const epsilon = 1e-10;

  const m = 1;
  let d = 1 - (a + b) * x / (a + 1);

  if (Math.abs(d) < epsilon) d = epsilon;
  d = 1 / d;
  let h = d;

  for (let i = 1; i <= maxIter; i++) {
    const m2 = 2 * i;
    let delta =
      (i * (b - i) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + delta * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    d = 1 / d;
    h *= d;

    delta = -((a + i) * (a + b + i) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + delta * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    d = 1 / d;
    h *= d;

    if (Math.abs(delta) < epsilon) break;
  }

  return h;
}

/**
 * Factorial function (uses logGamma for large numbers)
 */
export function factorial(n: number): number {
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  if (n > 170) return Infinity;
  return Math.exp(logGamma(n + 1));
}

/**
 * Binomial coefficient C(n, k)
 */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  return Math.exp(logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1));
}

/**
 * Compute square root via Newton-Raphson method
 */
export function sqrt(x: number): number {
  if (x < 0) return NaN;
  if (x === 0) return 0;
  let z = x;
  for (let i = 0; i < 50; i++) {
    const oldZ = z;
    z = (z + x / z) / 2;
    if (Math.abs(z - oldZ) < 1e-10) break;
  }
  return z;
}

/**
 * Error function erf(x) - used in normal distribution
 */
export function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1 / (1 + p * x);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-x * x);

  return sign * y;
}

/**
 * Complementary error function erfc(x) = 1 - erf(x)
 */
export function erfc(x: number): number {
  return 1 - erf(x);
}

/**
 * Sum of array elements
 */
export function sum(arr: number[]): number {
  return arr.reduce((acc, val) => acc + val, 0);
}

/**
 * Sum of squared elements
 */
export function sumSquares(arr: number[]): number {
  return arr.reduce((acc, val) => acc + val * val, 0);
}

/**
 * Sum of products of two arrays
 */
export function sumProducts(a: number[], b: number[]): number {
  return a.reduce((acc, val, i) => acc + val * b[i], 0);
}

/**
 * Vector dot product
 */
export function dotProduct(a: number[], b: number[]): number {
  return sumProducts(a, b);
}

/**
 * Vector magnitude/norm
 */
export function vectorNorm(v: number[]): number {
  return sqrt(sumSquares(v));
}

/**
 * Matrix multiplication
 */
export function matmul(a: number[][], b: number[][]): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < a.length; i++) {
    result[i] = [];
    for (let j = 0; j < b[0].length; j++) {
      result[i][j] = 0;
      for (let k = 0; k < b.length; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

/**
 * Matrix transpose
 */
export function transpose(m: number[][]): number[][] {
  return m[0].map((_, colIndex) => m.map((row) => row[colIndex]));
}

/**
 * Matrix trace (sum of diagonal elements)
 */
export function trace(m: number[][]): number {
  return m.reduce((sum, row, i) => sum + (row[i] || 0), 0);
}

/**
 * Determinant of 2x2 matrix
 */
export function det2(m: number[][]): number {
  return m[0][0] * m[1][1] - m[0][1] * m[1][0];
}

/**
 * Determinant of 3x3 matrix
 */
export function det3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

/**
 * LU decomposition for general matrix determinant
 */
export function determinant(m: number[][]): number {
  const n = m.length;
  if (n !== m[0].length) return NaN;
  if (n === 1) return m[0][0];
  if (n === 2) return det2(m);
  if (n === 3) return det3(m);

  const a = m.map((row) => [...row]);
  let det = 1;

  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    }

    if (Math.abs(a[pivot][i]) < 1e-10) return 0;

    if (pivot !== i) {
      [a[i], a[pivot]] = [a[pivot], a[i]];
      det *= -1;
    }

    det *= a[i][i];

    for (let j = i + 1; j < n; j++) {
      const factor = a[j][i] / a[i][i];
      for (let k = i; k < n; k++) {
        a[j][k] -= factor * a[i][k];
      }
    }
  }

  return det;
}

/**
 * Matrix inverse using Gauss-Jordan elimination
 */
export function matrixInverse(m: number[][]): number[][] | null {
  const n = m.length;
  if (n !== m[0].length) return null;

  const det = determinant(m);
  if (Math.abs(det) < 1e-10) return null;

  const a = m.map((row) => [...row]);
  const inv = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  // Forward elimination
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    }

    if (Math.abs(a[pivot][i]) < 1e-10) return null;

    [a[i], a[pivot]] = [a[pivot], a[i]];
    [inv[i], inv[pivot]] = [inv[pivot], inv[i]];

    const scale = a[i][i];
    for (let j = 0; j < n; j++) {
      a[i][j] /= scale;
      inv[i][j] /= scale;
    }

    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const factor = a[j][i];
        for (let k = 0; k < n; k++) {
          a[j][k] -= factor * a[i][k];
          inv[j][k] -= factor * inv[i][k];
        }
      }
    }
  }

  return inv;
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 */
export function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}
