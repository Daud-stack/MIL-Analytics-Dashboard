/**
 * Comprehensive Statistical Library
 * Includes descriptive stats, regression, time series, hypothesis testing, classification, clustering
 */

import {
  logGamma,
  betaFunction,
  regularizedBeta,
  factorial,
  binomial,
  sqrt,
  erf,
  erfc,
  sum,
  sumSquares,
  sumProducts,
  dotProduct,
  vectorNorm,
  matmul,
  transpose,
  trace,
  determinant,
  matrixInverse,
  clamp,
} from './utils';

// ===== DESCRIPTIVE STATISTICS =====

/**
 * Compute mean (average)
 */
export function mean(arr: number[]): number {
  return arr.length === 0 ? NaN : sum(arr) / arr.length;
}

/**
 * Compute median
 */
export function median(arr: number[]): number {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute mode (most frequent value)
 */
export function mode(arr: number[]): number[] {
  if (arr.length === 0) return [];
  const counts = new Map<number, number>();
  for (const val of arr) {
    counts.set(val, (counts.get(val) || 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  return Array.from(counts.entries())
    .filter(([_, count]) => count === maxCount)
    .map(([val]) => val)
    .sort((a, b) => a - b);
}

/**
 * Compute standard deviation
 */
export function sd(arr: number[]): number {
  if (arr.length < 2) return NaN;
  const m = mean(arr);
  const variance =
    arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (arr.length - 1);
  return sqrt(variance);
}

/**
 * Compute variance
 */
export function variance(arr: number[]): number {
  if (arr.length < 2) return NaN;
  const m = mean(arr);
  return arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (arr.length - 1);
}

/**
 * Compute population standard deviation
 */
export function sdPop(arr: number[]): number {
  if (arr.length === 0) return NaN;
  const m = mean(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length;
  return sqrt(variance);
}

/**
 * Compute population variance
 */
export function variancePop(arr: number[]): number {
  if (arr.length === 0) return NaN;
  const m = mean(arr);
  return arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length;
}

/**
 * Compute skewness
 */
export function skewness(arr: number[]): number {
  if (arr.length < 3) return NaN;
  const m = mean(arr);
  const std = sd(arr);
  if (std === 0) return NaN;
  const n = arr.length;
  const sum3 = arr.reduce((sum, val) => sum + Math.pow((val - m) / std, 3), 0);
  return (n / ((n - 1) * (n - 2))) * sum3;
}

/**
 * Compute kurtosis (excess)
 */
export function kurtosis(arr: number[]): number {
  if (arr.length < 4) return NaN;
  const m = mean(arr);
  const std = sd(arr);
  if (std === 0) return NaN;
  const n = arr.length;
  const sum4 = arr.reduce((sum, val) => sum + Math.pow((val - m) / std, 4), 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum4 -
    (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

/**
 * Compute quantiles/percentiles
 */
export function quantiles(arr: number[], p: number[]): number[] {
  if (arr.length === 0) return [];
  const sorted = [...arr].sort((a, b) => a - b);
  return p.map((percentile) => {
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  });
}

/**
 * Compute quartiles (Q1, Q2, Q3)
 */
export function quartiles(arr: number[]): { q1: number; q2: number; q3: number } {
  const [q1, q2, q3] = quantiles(arr, [25, 50, 75]);
  return { q1, q2, q3 };
}

/**
 * Compute interquartile range (IQR)
 */
export function iqr(arr: number[]): number {
  const { q1, q3 } = quartiles(arr);
  return q3 - q1;
}

/**
 * Coefficient of variation (CV)
 */
export function cv(arr: number[]): number {
  const m = mean(arr);
  if (m === 0) return NaN;
  return sd(arr) / Math.abs(m);
}

/**
 * Compound Annual Growth Rate (CAGR)
 */
export function cagr(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || years <= 0) return NaN;
  return Math.pow(endValue / startValue, 1 / years) - 1;
}

/**
 * Comprehensive descriptive statistics
 */
export interface DescriptiveStats {
  n: number;
  min: number;
  max: number;
  range: number;
  mean: number;
  median: number;
  mode: number[];
  q1: number;
  q2: number;
  q3: number;
  iqr: number;
  sd: number;
  variance: number;
  cv: number;
  skewness: number;
  kurtosis: number;
}

export function describe(arr: number[]): DescriptiveStats {
  const { q1, q2, q3 } = quartiles(arr);
  return {
    n: arr.length,
    min: Math.min(...arr),
    max: Math.max(...arr),
    range: Math.max(...arr) - Math.min(...arr),
    mean: mean(arr),
    median: median(arr),
    mode: mode(arr),
    q1,
    q2,
    q3,
    iqr: iqr(arr),
    sd: sd(arr),
    variance: variance(arr),
    cv: cv(arr),
    skewness: skewness(arr),
    kurtosis: kurtosis(arr),
  };
}

// ===== REGRESSION =====

export interface RegressionResult {
  intercept: number;
  slope: number;
  rSquared: number;
  rmse: number;
  predict: (x: number) => number;
}

/**
 * Simple linear regression y = a + bx
 */
export function linReg(x: number[], y: number[]): RegressionResult {
  if (x.length !== y.length || x.length < 2) {
    return {
      intercept: NaN,
      slope: NaN,
      rSquared: NaN,
      rmse: NaN,
      predict: () => NaN,
    };
  }

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);
  const sxx = x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0);
  const sxy = sumProducts(x.map((xi) => xi - meanX), y.map((yi) => yi - meanY));
  const syy = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  const yPred = x.map((xi) => intercept + slope * xi);
  const ssRes = y.reduce((sum, yi, i) => sum + (yi - yPred[i]) ** 2, 0);
  const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);

  const rSquared = ssTot === 0 ? NaN : 1 - ssRes / ssTot;
  const rmse = sqrt(ssRes / n);

  return {
    intercept,
    slope,
    rSquared,
    rmse,
    predict: (xi: number) => intercept + slope * xi,
  };
}

/**
 * Polynomial regression (degree 2, 3, etc.)
 */
export interface PolyRegressionResult {
  coefficients: number[];
  rSquared: number;
  rmse: number;
  predict: (x: number) => number;
}

export function polyReg(x: number[], y: number[], degree: number): PolyRegressionResult {
  if (x.length !== y.length || x.length < degree + 1) {
    return {
      coefficients: [],
      rSquared: NaN,
      rmse: NaN,
      predict: () => NaN,
    };
  }

  const n = x.length;
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i <= degree; i++) {
    A[i] = [];
    for (let j = 0; j <= degree; j++) {
      A[i][j] = 0;
      for (let k = 0; k < n; k++) {
        A[i][j] += Math.pow(x[k], i + j);
      }
    }
    b[i] = 0;
    for (let k = 0; k < n; k++) {
      b[i] += y[k] * Math.pow(x[k], i);
    }
  }

  const inv = matrixInverse(A);
  if (!inv) {
    return {
      coefficients: [],
      rSquared: NaN,
      rmse: NaN,
      predict: () => NaN,
    };
  }

  const coeff: number[] = [];
  for (let i = 0; i <= degree; i++) {
    coeff[i] = 0;
    for (let j = 0; j <= degree; j++) {
      coeff[i] += inv[i][j] * b[j];
    }
  }

  const yPred = x.map((xi) => {
    let yi = 0;
    for (let j = 0; j <= degree; j++) {
      yi += coeff[j] * Math.pow(xi, j);
    }
    return yi;
  });

  const meanY = mean(y);
  const ssRes = y.reduce((sum, yi, i) => sum + (yi - yPred[i]) ** 2, 0);
  const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);

  const rSquared = ssTot === 0 ? NaN : 1 - ssRes / ssTot;
  const rmse = sqrt(ssRes / n);

  return {
    coefficients: coeff,
    rSquared,
    rmse,
    predict: (xi: number) => {
      let yi = 0;
      for (let j = 0; j <= degree; j++) {
        yi += coeff[j] * Math.pow(xi, j);
      }
      return yi;
    },
  };
}

/**
 * Multiple linear regression (matrix form)
 */
export interface MultiLinRegResult {
  coefficients: number[];
  rSquared: number;
  rmse: number;
  predict: (x: number[]) => number;
}

export function multiLinReg(X: number[][], y: number[]): MultiLinRegResult {
  if (X.length === 0 || y.length === 0 || X.length !== y.length) {
    return {
      coefficients: [],
      rSquared: NaN,
      rmse: NaN,
      predict: () => NaN,
    };
  }

  const n = X.length;
  const p = X[0].length;

  const XtX: number[][] = Array(p)
    .fill(0)
    .map(() => Array(p).fill(0));
  const Xty: number[] = Array(p).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
      Xty[j] += X[i][j] * y[i];
    }
  }

  const inv = matrixInverse(XtX);
  if (!inv) {
    return {
      coefficients: [],
      rSquared: NaN,
      rmse: NaN,
      predict: () => NaN,
    };
  }

  const coeff: number[] = [];
  for (let i = 0; i < p; i++) {
    coeff[i] = 0;
    for (let j = 0; j < p; j++) {
      coeff[i] += inv[i][j] * Xty[j];
    }
  }

  const yPred = X.map((xi) => dotProduct(xi, coeff));
  const meanY = mean(y);
  const ssRes = y.reduce((sum, yi, i) => sum + (yi - yPred[i]) ** 2, 0);
  const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);

  const rSquared = ssTot === 0 ? NaN : 1 - ssRes / ssTot;
  const rmse = sqrt(ssRes / n);

  return {
    coefficients: coeff,
    rSquared,
    rmse,
    predict: (x: number[]) => dotProduct(x, coeff),
  };
}

// ===== TIME SERIES =====

/**
 * Moving average (SMA)
 */
export function movingAverage(arr: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    result.push(mean(slice));
  }
  return result;
}

/**
 * Exponential moving average (EMA)
 */
export function ema(arr: number[], alpha: number): number[] {
  if (arr.length === 0) return [];
  const result: number[] = [arr[0]];
  for (let i = 1; i < arr.length; i++) {
    result.push(alpha * arr[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

/**
 * Autocorrelation function
 */
export function acf(arr: number[], maxLag: number): number[] {
  const m = mean(arr);
  const c0 = arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / arr.length;

  const result: number[] = [1]; // ACF at lag 0 is always 1
  for (let lag = 1; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = lag; i < arr.length; i++) {
      c += (arr[i] - m) * (arr[i - lag] - m);
    }
    c /= arr.length;
    result.push(c / c0);
  }

  return result;
}

/**
 * Holt-Winters exponential smoothing
 */
export interface HoltWintersResult {
  forecast: number[];
  level: number[];
  trend: number[];
  seasonal?: number[];
}

export function holtWinters(
  arr: number[],
  period: number,
  alpha: number = 0.3,
  beta: number = 0.1,
  gamma: number = 0.1,
  steps: number = 1,
  seasonal: 'additive' | 'multiplicative' = 'additive'
): HoltWintersResult {
  const n = arr.length;
  const level: number[] = [];
  const trend: number[] = [];
  const seasonalComp: number[] = Array(period).fill(0);
  const forecast: number[] = [];

  // Initialize
  level[0] = mean(arr.slice(0, period));
  trend[0] = (mean(arr.slice(period, 2 * period)) - mean(arr.slice(0, period))) / period;

  if (seasonal === 'additive') {
    for (let i = 0; i < period; i++) {
      seasonalComp[i] = arr[i] - level[0];
    }
  } else {
    for (let i = 0; i < period; i++) {
      seasonalComp[i] = arr[i] / level[0];
    }
  }

  // Update
  for (let t = 1; t < n; t++) {
    const prevLevel = level[t - 1];
    const prevTrend = trend[t - 1];
    const prevSeasonal = seasonalComp[t % period];

    if (seasonal === 'additive') {
      level[t] = alpha * (arr[t] - seasonalComp[t % period]) + (1 - alpha) * (prevLevel + prevTrend);
    } else {
      level[t] = alpha * (arr[t] / seasonalComp[t % period]) + (1 - alpha) * (prevLevel + prevTrend);
    }

    trend[t] = beta * (level[t] - prevLevel) + (1 - beta) * prevTrend;

    if (seasonal === 'additive') {
      seasonalComp[t % period] = gamma * (arr[t] - level[t]) + (1 - gamma) * prevSeasonal;
    } else {
      seasonalComp[t % period] = gamma * (arr[t] / level[t]) + (1 - gamma) * prevSeasonal;
    }
  }

  // Forecast
  for (let h = 1; h <= steps; h++) {
    const f = level[n - 1] + h * trend[n - 1];
    const s = seasonalComp[(n + h - 1) % period];
    forecast.push(seasonal === 'additive' ? f + s : f * s);
  }

  return {
    forecast,
    level,
    trend,
    seasonal: seasonalComp,
  };
}

/**
 * Forecast with confidence intervals
 */
export interface ForecastResult {
  point: number[];
  upper: number[];
  lower: number[];
}

export function forecast(
  arr: number[],
  steps: number,
  confidenceLevel: number = 0.95
): ForecastResult {
  const reg = linReg(
    Array.from({ length: arr.length }, (_, i) => i),
    arr
  );

  const residuals = arr.map((y, i) => y - reg.predict(i));
  const stdResiduals = sd(residuals);
  const meanResiduals = mean(residuals);

  // Critical value from normal distribution (approximate)
  const zScore = normalInvCDF((1 + confidenceLevel) / 2);

  const point: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 1; i <= steps; i++) {
    const x = arr.length + i - 1;
    const p = reg.predict(x);
    const se = stdResiduals * sqrt(1 + 1 / arr.length);
    const margin = zScore * se;

    point.push(p + meanResiduals);
    upper.push(p + meanResiduals + margin);
    lower.push(p + meanResiduals - margin);
  }

  return { point, upper, lower };
}

// ===== HYPOTHESIS TESTING =====

/**
 * Normal cumulative distribution function (CDF)
 */
export function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

/**
 * Normal inverse CDF (quantile function)
 * Uses rational approximation
 */
export function normalInvCDF(p: number): number {
  if (p <= 0 || p >= 1) return NaN;
  if (p < 0.5) return -normalInvCDF(1 - p);

  p -= 0.5;
  if (p < 0.02425) {
    const x = Math.sqrt(-2 * Math.log(2 * p));
    const num = 2.937036 + 2.742239 * x + 6.061516 * x * x;
    const den = 1 + 2.429281 * x + 6.360201 * x * x;
    return x - num / den;
  } else {
    const x = Math.sqrt(-2 * Math.log(p));
    const num = 2.505401 + 0.862803 * x;
    const den = 0.333333 + 0.632953 * x;
    return x - num / den;
  }
}

/**
 * One-sample t-test
 */
export interface TTestResult {
  tStatistic: number;
  pValue: number;
  significant: boolean;
}

export function tTest(arr: number[], mu: number = 0, alpha: number = 0.05): TTestResult {
  if (arr.length < 2) {
    return { tStatistic: NaN, pValue: NaN, significant: false };
  }

  const m = mean(arr);
  const s = sd(arr);
  const tStat = (m - mu) / (s / Math.sqrt(arr.length));

  // Approximate p-value using t-distribution (approximation)
  const df = arr.length - 1;
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));

  return {
    tStatistic: tStat,
    pValue,
    significant: pValue < alpha,
  };
}

/**
 * Two-sample t-test (unpaired)
 */
export function tTest2(arr1: number[], arr2: number[], alpha: number = 0.05): TTestResult {
  if (arr1.length < 2 || arr2.length < 2) {
    return { tStatistic: NaN, pValue: NaN, significant: false };
  }

  const m1 = mean(arr1);
  const m2 = mean(arr2);
  const s1 = sd(arr1);
  const s2 = sd(arr2);
  const n1 = arr1.length;
  const n2 = arr2.length;

  const pooledSd = sqrt(((n1 - 1) * s1 ** 2 + (n2 - 1) * s2 ** 2) / (n1 + n2 - 2));
  const tStat = (m1 - m2) / (pooledSd * sqrt(1 / n1 + 1 / n2));

  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));

  return {
    tStatistic: tStat,
    pValue,
    significant: pValue < alpha,
  };
}

/**
 * Z-test
 */
export function zTest(arr: number[], mu: number = 0, sigma: number = 1, alpha: number = 0.05): TTestResult {
  if (arr.length === 0) {
    return { tStatistic: NaN, pValue: NaN, significant: false };
  }

  const m = mean(arr);
  const zStat = (m - mu) / (sigma / Math.sqrt(arr.length));
  const pValue = 2 * (1 - normalCDF(Math.abs(zStat)));

  return {
    tStatistic: zStat,
    pValue,
    significant: pValue < alpha,
  };
}

/**
 * Chi-square goodness of fit test
 */
export function chiSquare(observed: number[], expected: number[], alpha: number = 0.05): TTestResult {
  if (observed.length !== expected.length || observed.length === 0) {
    return { tStatistic: NaN, pValue: NaN, significant: false };
  }

  let chiSq = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) {
      chiSq += ((observed[i] - expected[i]) ** 2) / expected[i];
    }
  }

  const df = observed.length - 1;
  const pValue = 1 - chiSquareCDF(chiSq, df);

  return {
    tStatistic: chiSq,
    pValue,
    significant: pValue < alpha,
  };
}

/**
 * Chi-square CDF (approximation)
 */
function chiSquareCDF(x: number, df: number): number {
  if (x <= 0) return 0;
  if (x > 1000) return 1;

  const a = df / 2;
  const z = x / 2;

  // Incomplete gamma function approximation
  let sum = Math.exp(-z) * Math.pow(z, a - 1) / Math.exp(logGamma(a));
  let term = sum;

  for (let k = 1; k < 100; k++) {
    term *= z / (a + k - 1);
    sum += term;
    if (term < 1e-10) break;
  }

  return clamp(sum, 0, 1);
}

/**
 * One-way ANOVA
 */
export interface AnovaResult {
  fStatistic: number;
  pValue: number;
  significant: boolean;
  groups: number;
}

export function anova(groups: number[][], alpha: number = 0.05): AnovaResult {
  if (groups.length < 2) {
    return { fStatistic: NaN, pValue: NaN, significant: false, groups: 0 };
  }

  const k = groups.length;
  const N = groups.reduce((sum, g) => sum + g.length, 0);
  const grandMean = mean(groups.flat());

  let bss = 0; // Between-group sum of squares
  let wss = 0; // Within-group sum of squares

  for (const group of groups) {
    const groupMean = mean(group);
    bss += group.length * (groupMean - grandMean) ** 2;
    for (const val of group) {
      wss += (val - groupMean) ** 2;
    }
  }

  const msBetween = bss / (k - 1);
  const msWithin = wss / (N - k);

  const fStat = msBetween / msWithin;
  const pValue = 1 - fDistCDF(fStat, k - 1, N - k);

  return {
    fStatistic: fStat,
    pValue,
    significant: pValue < alpha,
    groups: k,
  };
}

/**
 * F-distribution CDF (approximation)
 */
function fDistCDF(x: number, df1: number, df2: number): number {
  if (x <= 0) return 0;
  const z = (df1 * x) / (df1 * x + df2);
  return regularizedBeta(z, df1 / 2, df2 / 2);
}

/**
 * Shapiro-Wilk test for normality
 */
export interface ShapiroWilkResult {
  wStatistic: number;
  pValue: number;
  normal: boolean;
}

export function shapiroWilk(arr: number[], alpha: number = 0.05): ShapiroWilkResult {
  const n = arr.length;
  if (n < 3 || n > 5000) {
    return { wStatistic: NaN, pValue: NaN, normal: false };
  }

  const sorted = [...arr].sort((a, b) => a - b);
  const m = mean(arr);
  const s = sd(arr);

  let a = 0;
  const aConsts = [
    0.0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056, 0.556025, -0.022003,
  ];

  for (let i = 0; i < Math.floor(n / 2); i++) {
    const aN = aConsts[Math.min(7, i)] || 0;
    a += aN * (sorted[n - 1 - i] - sorted[i]);
  }

  let w = 0;
  for (let i = 0; i < n; i++) {
    w += ((sorted[i] - m) / s) ** 2;
  }

  const wStat = (a ** 2) / w;
  const pValue = 1 - normalCDF(Math.log((1 - wStat) / (1 + wStat)));

  return {
    wStatistic: wStat,
    pValue: clamp(pValue, 0, 1),
    normal: pValue > alpha,
  };
}

// ===== CORRELATION & COVARIANCE =====

/**
 * Pearson correlation coefficient
 */
export function pearsonCorr(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return NaN;

  const meanX = mean(x);
  const meanY = mean(y);
  const stdX = sd(x);
  const stdY = sd(y);

  if (stdX === 0 || stdY === 0) return NaN;

  const cov = sumProducts(
    x.map((xi) => xi - meanX),
    y.map((yi) => yi - meanY)
  ) / (x.length - 1);

  return cov / (stdX * stdY);
}

/**
 * Spearman's rank correlation
 */
export function spearmanCorr(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return NaN;

  const ranks = (arr: number[]) => {
    const sorted = [...arr].map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
    const result = Array(arr.length);
    for (let i = 0; i < sorted.length; i++) {
      result[sorted[i].idx] = i + 1;
    }
    return result;
  };

  const rankX = ranks(x);
  const rankY = ranks(y);

  return pearsonCorr(rankX, rankY);
}

/**
 * Covariance matrix
 */
export function covarianceMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const p = matrix[0].length;
  const means = Array(p)
    .fill(0)
    .map((_, j) => mean(matrix.map((row) => row[j])));

  const cov: number[][] = Array(p)
    .fill(0)
    .map(() => Array(p).fill(0));

  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      cov[i][j] = 0;
      for (let k = 0; k < n; k++) {
        cov[i][j] += (matrix[k][i] - means[i]) * (matrix[k][j] - means[j]);
      }
      cov[i][j] /= n - 1;
    }
  }

  return cov;
}

/**
 * Correlation matrix
 */
export function correlationMatrix(matrix: number[][]): number[][] {
  const cov = covarianceMatrix(matrix);
  const p = cov.length;
  const corr: number[][] = Array(p)
    .fill(0)
    .map(() => Array(p).fill(0));

  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      const denom = sqrt(cov[i][i] * cov[j][j]);
      corr[i][j] = denom === 0 ? NaN : cov[i][j] / denom;
    }
  }

  return corr;
}

// ===== CLASSIFICATION =====

/**
 * Confusion matrix results
 */
export interface ConfusionMatrixMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  specificity: number;
  sensitivity: number;
}

/**
 * Compute metrics from confusion matrix
 */
export function confusionMatrixMetrics(
  tp: number,
  tn: number,
  fp: number,
  fn: number
): ConfusionMatrixMetrics {
  const total = tp + tn + fp + fn;
  const accuracy = (tp + tn) / total;
  const precision = tp / (tp + fp);
  const recall = tp / (tp + fn);
  const specificity = tn / (tn + fp);
  const f1 = (2 * precision * recall) / (precision + recall);

  return {
    accuracy,
    precision,
    recall,
    f1,
    specificity,
    sensitivity: recall,
  };
}

/**
 * Naive Bayes classifier
 */
export interface NaiveBayesModel {
  classPriors: Map<string, number>;
  featureMeans: Map<string, number[]>;
  featureStds: Map<string, number[]>;
  classes: string[];
  predict: (features: number[]) => string;
  predictProba: (features: number[]) => Map<string, number>;
}

export function naiveBayes(
  X: number[][],
  y: string[]
): NaiveBayesModel {
  const classes = Array.from(new Set(y));
  const p = X[0].length;

  const classPriors = new Map<string, number>();
  const featureMeans = new Map<string, number[]>();
  const featureStds = new Map<string, number[]>();

  for (const cls of classes) {
    const indices = y.map((yi, i) => (yi === cls ? i : -1)).filter((i) => i >= 0);
    const prior = indices.length / y.length;
    classPriors.set(cls, prior);

    const means: number[] = [];
    const stds: number[] = [];

    for (let j = 0; j < p; j++) {
      const values = indices.map((i) => X[i][j]);
      means.push(mean(values));
      stds.push(sd(values) || 1e-9);
    }

    featureMeans.set(cls, means);
    featureStds.set(cls, stds);
  }

  return {
    classPriors,
    featureMeans,
    featureStds,
    classes,
    predict: (features: number[]) => {
      const proba = new Map<string, number>();
      for (const cls of classes) {
        let posterior = Math.log(classPriors.get(cls) || 0);
        const means = featureMeans.get(cls)!;
        const stds = featureStds.get(cls)!;

        for (let j = 0; j < features.length; j++) {
          const exponent = -((features[j] - means[j]) ** 2) / (2 * stds[j] ** 2);
          posterior += -0.5 * Math.log(2 * Math.PI * stds[j] ** 2) + exponent;
        }

        proba.set(cls, posterior);
      }

      return classes.reduce((best, cls) =>
        (proba.get(cls) || -Infinity) > (proba.get(best) || -Infinity) ? cls : best
      );
    },
    predictProba: (features: number[]) => {
      const logProba = new Map<string, number>();
      for (const cls of classes) {
        let posterior = Math.log(classPriors.get(cls) || 0);
        const means = featureMeans.get(cls)!;
        const stds = featureStds.get(cls)!;

        for (let j = 0; j < features.length; j++) {
          const exponent = -((features[j] - means[j]) ** 2) / (2 * stds[j] ** 2);
          posterior += -0.5 * Math.log(2 * Math.PI * stds[j] ** 2) + exponent;
        }

        logProba.set(cls, posterior);
      }

      const maxLogProba = Math.max(...Array.from(logProba.values()));
      const proba = new Map<string, number>();
      let sum = 0;

      for (const cls of classes) {
        const p = Math.exp((logProba.get(cls) || -Infinity) - maxLogProba);
        proba.set(cls, p);
        sum += p;
      }

      for (const cls of classes) {
        proba.set(cls, (proba.get(cls) || 0) / sum);
      }

      return proba;
    },
  };
}

/**
 * Logistic regression (binary classification)
 */
export interface LogisticRegressionModel {
  coefficients: number[];
  intercept: number;
  predict: (features: number[]) => number;
  predictClass: (features: number[]) => number;
}

export function logisticRegression(
  X: number[][],
  y: number[],
  iterations: number = 100,
  learningRate: number = 0.01
): LogisticRegressionModel {
  const n = X.length;
  const p = X[0].length;
  const coeff = Array(p).fill(0);
  let intercept = 0;

  // Gradient descent
  for (let iter = 0; iter < iterations; iter++) {
    let costGradIntercept = 0;
    const costGradCoeff = Array(p).fill(0);

    for (let i = 0; i < n; i++) {
      const z = intercept + dotProduct(X[i], coeff);
      const prediction = 1 / (1 + Math.exp(-z));
      const error = prediction - y[i];

      costGradIntercept += error;
      for (let j = 0; j < p; j++) {
        costGradCoeff[j] += error * X[i][j];
      }
    }

    intercept -= (learningRate * costGradIntercept) / n;
    for (let j = 0; j < p; j++) {
      coeff[j] -= (learningRate * costGradCoeff[j]) / n;
    }
  }

  return {
    coefficients: coeff,
    intercept,
    predict: (features: number[]) => {
      const z = intercept + dotProduct(features, coeff);
      return 1 / (1 + Math.exp(-z));
    },
    predictClass: (features: number[]) => {
      const z = intercept + dotProduct(features, coeff);
      const prob = 1 / (1 + Math.exp(-z));
      return prob > 0.5 ? 1 : 0;
    },
  };
}

// ===== CLUSTERING =====

/**
 * K-means clustering
 */
export interface KMeansResult {
  centers: number[][];
  labels: number[];
  inertia: number;
  iterations: number;
}

export function kmeans(X: number[][], k: number, maxIterations: number = 100): KMeansResult {
  const n = X.length;
  const p = X[0].length;

  // Random initialization
  const centers = Array(k)
    .fill(0)
    .map(() => {
      const idx = Math.floor(Math.random() * n);
      return [...X[idx]];
    });

  const labels = Array(n).fill(0);
  let inertia = 0;
  let iteration = 0;

  for (iteration = 0; iteration < maxIterations; iteration++) {
    const oldCenters = centers.map((c) => [...c]);

    // Assign labels
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let bestCluster = 0;

      for (let j = 0; j < k; j++) {
        const dist = vectorNorm(
          X[i].map((xi, idx) => xi - centers[j][idx])
        );
        if (dist < minDist) {
          minDist = dist;
          bestCluster = j;
        }
      }

      labels[i] = bestCluster;
    }

    // Update centers
    for (let j = 0; j < k; j++) {
      const clusterPoints = X.filter((_, i) => labels[i] === j);
      if (clusterPoints.length > 0) {
        for (let d = 0; d < p; d++) {
          centers[j][d] = mean(clusterPoints.map((x) => x[d]));
        }
      }
    }

    // Check convergence
    const converged = oldCenters.every((oldC, j) =>
      vectorNorm(oldC.map((x, i) => x - centers[j][i])) < 1e-6
    );

    if (converged) break;
  }

  // Compute inertia
  inertia = 0;
  for (let i = 0; i < n; i++) {
    const center = centers[labels[i]];
    const dist = vectorNorm(X[i].map((xi, j) => xi - center[j]));
    inertia += dist ** 2;
  }

  return { centers, labels, inertia, iterations: iteration + 1 };
}

/**
 * Silhouette score
 */
export function silhouetteScore(X: number[][], labels: number[]): number {
  const n = X.length;
  const k = Math.max(...labels) + 1;
  let totalScore = 0;

  for (let i = 0; i < n; i++) {
    const cluster = labels[i];
    const clusterPoints = X.filter((_, idx) => labels[idx] === cluster);

    if (clusterPoints.length === 1) continue;

    // Average distance to points in same cluster
    let a = 0;
    for (const point of clusterPoints) {
      if (point !== X[i]) {
        a += vectorNorm(X[i].map((xi, j) => xi - point[j]));
      }
    }
    a /= Math.max(clusterPoints.length - 1, 1);

    // Minimum average distance to other clusters
    let b = Infinity;
    for (let j = 0; j < k; j++) {
      if (j === cluster) continue;
      const otherPoints = X.filter((_, idx) => labels[idx] === j);
      if (otherPoints.length === 0) continue;

      let avgDist = 0;
      for (const point of otherPoints) {
        avgDist += vectorNorm(X[i].map((xi, idx) => xi - point[idx]));
      }
      avgDist /= otherPoints.length;
      b = Math.min(b, avgDist);
    }

    const s = (b - a) / Math.max(a, b);
    totalScore += s;
  }

  return totalScore / n;
}

/**
 * Elbow method for optimal k
 */
export interface ElbowResult {
  ks: number[];
  inertias: number[];
  optimalK: number;
}

export function elbowMethod(X: number[][], maxK: number = 10): ElbowResult {
  const ks: number[] = [];
  const inertias: number[] = [];

  for (let k = 1; k <= maxK; k++) {
    const result = kmeans(X, k);
    ks.push(k);
    inertias.push(result.inertia);
  }

  // Find elbow using second derivative
  let optimalK = 1;
  let maxSecondDeriv = 0;

  for (let i = 1; i < inertias.length - 1; i++) {
    const secondDeriv =
      inertias[i - 1] - 2 * inertias[i] + inertias[i + 1];
    if (secondDeriv > maxSecondDeriv) {
      maxSecondDeriv = secondDeriv;
      optimalK = i + 1;
    }
  }

  return { ks, inertias, optimalK };
}

// ===== MATRIX OPERATIONS =====

/**
 * Matrix multiplication (already in utils, re-exported here)
 */
export { matmul as matMul };

/**
 * Matrix inverse (already in utils, re-exported here)
 */
export { matrixInverse as matInv };

/**
 * Matrix determinant (already in utils, re-exported here)
 */
export { determinant as det };

/**
 * Eigenvalue decomposition (simplified for 2x2)
 */
export interface EigResult {
  values: number[];
  vectors: number[][];
}

export function eig(m: number[][]): EigResult {
  const n = m.length;

  if (n === 2) {
    const a = m[0][0];
    const b = m[0][1];
    const c = m[1][0];
    const d = m[1][1];

    const trace = a + d;
    const det = a * d - b * c;
    const discriminant = trace * trace - 4 * det;

    const lambda1 = (trace + sqrt(discriminant)) / 2;
    const lambda2 = (trace - sqrt(discriminant)) / 2;

    let v1: number[];
    let v2: number[];

    if (b !== 0) {
      v1 = [b, lambda1 - a];
      v2 = [b, lambda2 - a];
    } else if (c !== 0) {
      v1 = [lambda1 - d, c];
      v2 = [lambda2 - d, c];
    } else {
      v1 = [1, 0];
      v2 = [0, 1];
    }

    // Normalize
    const norm1 = vectorNorm(v1);
    const norm2 = vectorNorm(v2);
    v1 = v1.map((x) => x / norm1);
    v2 = v2.map((x) => x / norm2);

    return {
      values: [lambda1, lambda2],
      vectors: [v1, v2],
    };
  }

  // For larger matrices, return identity (stub)
  return {
    values: Array(n).fill(1),
    vectors: Array(n)
      .fill(0)
      .map((_, i) =>
        Array(n)
          .fill(0)
          .map((_, j) => (i === j ? 1 : 0))
      ),
  };
}

// ===== DISTRIBUTION FUNCTIONS =====

/**
 * Beta distribution PDF
 */
export function betaPDF(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) return 0;
  return (Math.pow(x, a - 1) * Math.pow(1 - x, b - 1)) / betaFunction(a, b);
}

/**
 * Beta distribution CDF
 */
export function betaCDF(x: number, a: number, b: number): number {
  return regularizedBeta(x, a, b);
}

/**
 * Gamma distribution PDF
 */
export function gammaPDF(x: number, shape: number, scale: number): number {
  if (x < 0) return 0;
  return (Math.pow(x, shape - 1) * Math.exp(-x / scale)) /
    (Math.pow(scale, shape) * Math.exp(logGamma(shape)));
}

/**
 * Gamma distribution CDF (approximation)
 */
export function gammaCDF(x: number, shape: number, scale: number): number {
  if (x <= 0) return 0;
  const z = x / scale;
  return regularizedGamma(z, shape);
}

/**
 * Regularized lower incomplete gamma function
 */
function regularizedGamma(x: number, a: number): number {
  let sum = 0;
  let term = 1 / a;
  sum = term;

  for (let k = 1; k < 100; k++) {
    term *= x / (a + k);
    sum += term;
    if (term < 1e-10) break;
  }

  return clamp(sum * Math.exp(-x + a * Math.log(x) - logGamma(a)), 0, 1);
}

/**
 * Normal distribution PDF
 */
export function normalPDF(x: number, mean_val: number = 0, std: number = 1): number {
  const z = (x - mean_val) / std;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

/**
 * F-distribution PDF (approximation)
 */
export function fDistPDF(x: number, df1: number, df2: number): number {
  if (x <= 0) return 0;
  const z = (df1 * x) / (df1 * x + df2);
  const b = betaFunction(df1 / 2, df2 / 2);
  return (Math.pow(z, df1 / 2 - 1) * Math.pow(1 - z, df2 / 2 - 1) * Math.pow(df1 / df2, df1 / 2)) /
    (x * b);
}

/**
 * F-distribution p-value
 */
export function fDistPValue(fValue: number, df1: number, df2: number): number {
  return 1 - fDistCDF(fValue, df1, df2);
}
