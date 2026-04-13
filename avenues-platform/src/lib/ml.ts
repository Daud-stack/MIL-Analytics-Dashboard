'use client';

/**
 * Client-side Machine Learning utilities
 * Implements Linear Regression, Logistic Regression, and Naive Bayes from scratch.
 * No external dependencies required.
 */

// ─── Types ──────────────────────────────────────────────────

export interface MLDataset {
  X: number[][];      // feature matrix (n_samples × n_features)
  y: number[];        // target vector (n_samples)
  featureNames: string[];
  sampleLabels: string[];
}

export interface TrainTestSplit {
  X_train: number[][];
  y_train: number[];
  X_test: number[][];
  y_test: number[];
  trainIndices: number[];
  testIndices: number[];
}

export interface ConfusionMatrix {
  TP: number;
  FP: number;
  TN: number;
  FN: number;
}

export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  confusionMatrix: ConfusionMatrix;
}

export interface RegressionMetrics {
  r2: number;
  mae: number;
  rmse: number;
  mape: number;
}

export interface ROCPoint {
  fpr: number;
  tpr: number;
  threshold: number;
}

export interface TrainedModel {
  type: 'linear-regression' | 'logistic-regression' | 'naive-bayes';
  coefficients: number[];
  intercept: number;
  featureImportance: { feature: string; importance: number }[];
  classificationMetrics?: ClassificationMetrics;
  regressionMetrics?: RegressionMetrics;
  rocCurve?: ROCPoint[];
  predictions: number[];
  probabilities?: number[];
  actualValues: number[];
  trainingTime: number;
  samplesUsed: number;
  cvScores?: number[];
}

// ─── Data Preparation ───────────────────────────────────────

/**
 * Standard-scale features (zero mean, unit variance)
 */
export function standardScale(X: number[][]): { scaled: number[][]; means: number[]; stds: number[] } {
  const n = X.length;
  const m = X[0]?.length || 0;
  const means = new Array(m).fill(0);
  const stds = new Array(m).fill(0);

  // Compute means
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) means[j] += X[i][j];
    means[j] /= n;
  }

  // Compute standard deviations
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) stds[j] += Math.pow(X[i][j] - means[j], 2);
    stds[j] = Math.sqrt(stds[j] / n) || 1; // avoid division by zero
  }

  // Scale
  const scaled = X.map(row => row.map((val, j) => (val - means[j]) / stds[j]));

  return { scaled, means, stds };
}

/**
 * Split dataset into train/test sets
 */
export function trainTestSplit(
  X: number[][],
  y: number[],
  trainRatio: number = 0.7,
  seed: number = 42
): TrainTestSplit {
  const n = X.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  // Seeded shuffle
  let s = seed;
  const rng = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const splitIdx = Math.round(n * trainRatio);
  const trainIndices = indices.slice(0, splitIdx);
  const testIndices = indices.slice(splitIdx);

  return {
    X_train: trainIndices.map(i => X[i]),
    y_train: trainIndices.map(i => y[i]),
    X_test: testIndices.map(i => X[i]),
    y_test: testIndices.map(i => y[i]),
    trainIndices,
    testIndices,
  };
}

// ─── Linear Regression (OLS via Normal Equation) ────────────

function matTranspose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0].length;
  const result: number[][] = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      result[j][i] = A[i][j];
  return result;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const result: number[][] = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++)
    for (let k = 0; k < colsA; k++)
      for (let j = 0; j < colsB; j++)
        result[i][j] += A[i][k] * B[k][j];
  return result;
}

function matVecMul(A: number[][], v: number[]): number[] {
  return A.map(row => row.reduce((sum, val, j) => sum + val * v[j], 0));
}

/**
 * Invert a small matrix using Gauss-Jordan elimination
 */
function matInverse(A: number[][]): number[][] | null {
  const n = A.length;
  const aug: number[][] = A.map((row, i) => {
    const identity = new Array(n).fill(0);
    identity[i] = 1;
    return [...row, ...identity];
  });

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) return null; // Singular

    // Scale pivot row
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map(row => row.slice(n));
}

/**
 * Fit linear regression using Normal Equation: β = (X'X)^-1 X'y
 */
export function fitLinearRegression(
  X: number[][],
  y: number[]
): { coefficients: number[]; intercept: number } {
  const m = X[0]?.length || 0;

  // Add intercept column (column of 1s)
  const Xb = X.map(row => [1, ...row]);

  const Xt = matTranspose(Xb);
  const XtX = matMul(Xt, Xb);
  const XtXinv = matInverse(XtX);

  if (!XtXinv) {
    // Fallback: ridge regression with small lambda
    for (let i = 0; i < XtX.length; i++) XtX[i][i] += 0.01;
    const ridge = matInverse(XtX);
    if (!ridge) return { coefficients: new Array(m).fill(0), intercept: 0 };
    const Xty = Xb.reduce((acc, row, i) => {
      return acc.map((v, j) => v + row[j] * y[i]);
    }, new Array(m + 1).fill(0));
    const beta = matVecMul(ridge, Xty);
    return { intercept: beta[0], coefficients: beta.slice(1) };
  }

  const Xty = Xb.reduce((acc, row, i) => {
    return acc.map((v, j) => v + row[j] * y[i]);
  }, new Array(m + 1).fill(0));

  const beta = matVecMul(XtXinv, Xty);
  return { intercept: beta[0], coefficients: beta.slice(1) };
}

export function predictLinear(
  X: number[][],
  coefficients: number[],
  intercept: number
): number[] {
  return X.map(row => intercept + row.reduce((sum, val, j) => sum + val * coefficients[j], 0));
}

export function computeRegressionMetrics(actual: number[], predicted: number[]): RegressionMetrics {
  const n = actual.length;
  const meanActual = actual.reduce((a, b) => a + b, 0) / n;

  let ssRes = 0, ssTot = 0, absErrors = 0, sqErrors = 0, pctErrors = 0;
  let pctCount = 0;

  for (let i = 0; i < n; i++) {
    const err = actual[i] - predicted[i];
    ssRes += err * err;
    ssTot += Math.pow(actual[i] - meanActual, 2);
    absErrors += Math.abs(err);
    sqErrors += err * err;
    if (actual[i] !== 0) {
      pctErrors += Math.abs(err / actual[i]);
      pctCount++;
    }
  }

  return {
    r2: ssTot > 0 ? 1 - ssRes / ssTot : 0,
    mae: absErrors / n,
    rmse: Math.sqrt(sqErrors / n),
    mape: pctCount > 0 ? (pctErrors / pctCount) * 100 : 0,
  };
}

// ─── Logistic Regression (Gradient Descent) ─────────────────

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
}

/**
 * Fit logistic regression via batch gradient descent
 */
export function fitLogisticRegression(
  X: number[][],
  y: number[],
  learningRate: number = 0.1,
  maxIter: number = 1000,
  lambda: number = 0.01 // L2 regularization
): { coefficients: number[]; intercept: number } {
  const n = X.length;
  const m = X[0]?.length || 0;

  const weights = new Array(m).fill(0);
  let bias = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    const gradW = new Array(m).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      const z = bias + X[i].reduce((sum, val, j) => sum + val * weights[j], 0);
      const pred = sigmoid(z);
      const err = pred - y[i];

      gradB += err;
      for (let j = 0; j < m; j++) {
        gradW[j] += err * X[i][j];
      }
    }

    // Update with regularization
    bias -= (learningRate / n) * gradB;
    for (let j = 0; j < m; j++) {
      weights[j] -= (learningRate / n) * (gradW[j] + lambda * weights[j]);
    }
  }

  return { coefficients: weights, intercept: bias };
}

export function predictLogistic(
  X: number[][],
  coefficients: number[],
  intercept: number
): { predictions: number[]; probabilities: number[] } {
  const probabilities = X.map(row =>
    sigmoid(intercept + row.reduce((sum, val, j) => sum + val * coefficients[j], 0))
  );
  const predictions = probabilities.map(p => (p >= 0.5 ? 1 : 0));
  return { predictions, probabilities };
}

// ─── Naive Bayes (Gaussian) ─────────────────────────────────

interface GaussianNBModel {
  classPriors: Record<number, number>;
  classMeans: Record<number, number[]>;
  classVars: Record<number, number[]>;
}

export function fitNaiveBayes(X: number[][], y: number[]): GaussianNBModel {
  const classes = [...new Set(y)];
  const n = X.length;
  const m = X[0]?.length || 0;

  const classPriors: Record<number, number> = {};
  const classMeans: Record<number, number[]> = {};
  const classVars: Record<number, number[]> = {};

  for (const c of classes) {
    const classX = X.filter((_, i) => y[i] === c);
    const nc = classX.length;
    classPriors[c] = nc / n;

    // Mean per feature
    const means = new Array(m).fill(0);
    for (const row of classX)
      for (let j = 0; j < m; j++) means[j] += row[j];
    for (let j = 0; j < m; j++) means[j] /= nc;
    classMeans[c] = means;

    // Variance per feature
    const vars = new Array(m).fill(0);
    for (const row of classX)
      for (let j = 0; j < m; j++) vars[j] += Math.pow(row[j] - means[j], 2);
    for (let j = 0; j < m; j++) vars[j] = vars[j] / nc + 1e-9; // smoothing
    classVars[c] = vars;
  }

  return { classPriors, classMeans, classVars };
}

function gaussianLogPdf(x: number, mean: number, variance: number): number {
  return -0.5 * Math.log(2 * Math.PI * variance) - Math.pow(x - mean, 2) / (2 * variance);
}

export function predictNaiveBayes(
  X: number[][],
  model: GaussianNBModel
): { predictions: number[]; probabilities: number[] } {
  const classes = Object.keys(model.classPriors).map(Number);

  const results = X.map(row => {
    const logProbs: Record<number, number> = {};

    for (const c of classes) {
      let logP = Math.log(model.classPriors[c]);
      for (let j = 0; j < row.length; j++) {
        logP += gaussianLogPdf(row[j], model.classMeans[c][j], model.classVars[c][j]);
      }
      logProbs[c] = logP;
    }

    // Softmax to get probabilities
    const maxLog = Math.max(...Object.values(logProbs));
    const expSum = Object.values(logProbs).reduce((s, lp) => s + Math.exp(lp - maxLog), 0);
    const prob1 = classes.includes(1)
      ? Math.exp(logProbs[1] - maxLog) / expSum
      : 0;

    const prediction = prob1 >= 0.5 ? 1 : 0;
    return { prediction, probability: prob1 };
  });

  return {
    predictions: results.map(r => r.prediction),
    probabilities: results.map(r => r.probability),
  };
}

// ─── Evaluation Metrics ─────────────────────────────────────

export function computeConfusionMatrix(actual: number[], predicted: number[]): ConfusionMatrix {
  let TP = 0, FP = 0, TN = 0, FN = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] === 1 && predicted[i] === 1) TP++;
    else if (actual[i] === 0 && predicted[i] === 1) FP++;
    else if (actual[i] === 0 && predicted[i] === 0) TN++;
    else FN++;
  }
  return { TP, FP, TN, FN };
}

export function computeClassificationMetrics(
  actual: number[],
  predicted: number[],
  probabilities: number[]
): ClassificationMetrics {
  const cm = computeConfusionMatrix(actual, predicted);
  const { TP, FP, TN, FN } = cm;

  const accuracy = (TP + TN) / (TP + FP + TN + FN) || 0;
  const precision = TP / (TP + FP) || 0;
  const recall = TP / (TP + FN) || 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const auc = computeAUC(actual, probabilities);

  return { accuracy, precision, recall, f1Score, auc, confusionMatrix: cm };
}

/**
 * Compute AUC using the trapezoidal rule on the ROC curve
 */
export function computeAUC(actual: number[], probabilities: number[]): number {
  const roc = computeROCCurve(actual, probabilities);
  let auc = 0;
  for (let i = 1; i < roc.length; i++) {
    auc += (roc[i].fpr - roc[i - 1].fpr) * (roc[i].tpr + roc[i - 1].tpr) / 2;
  }
  return Math.max(0, Math.min(1, auc));
}

/**
 * Compute the actual ROC curve from probabilities
 */
export function computeROCCurve(actual: number[], probabilities: number[]): ROCPoint[] {
  const thresholds = [1.01, ...probabilities.slice().sort((a, b) => b - a), -0.01];
  const uniqueThresholds = [...new Set(thresholds)];

  const points: ROCPoint[] = [];
  const totalP = actual.filter(v => v === 1).length;
  const totalN = actual.filter(v => v === 0).length;

  for (const threshold of uniqueThresholds) {
    let tp = 0, fp = 0;
    for (let i = 0; i < actual.length; i++) {
      if (probabilities[i] >= threshold) {
        if (actual[i] === 1) tp++;
        else fp++;
      }
    }
    points.push({
      fpr: totalN > 0 ? fp / totalN : 0,
      tpr: totalP > 0 ? tp / totalP : 0,
      threshold,
    });
  }

  // Sort by FPR for clean curve
  points.sort((a, b) => a.fpr - b.fpr || a.tpr - b.tpr);
  return points;
}

// ─── Cross-Validation ───────────────────────────────────────

/**
 * K-Fold cross-validation for classification models
 */
export function kFoldCV(
  X: number[][],
  y: number[],
  k: number,
  modelType: 'logistic-regression' | 'naive-bayes',
  seed: number = 42
): number[] {
  const n = X.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  // Seeded shuffle
  let s = seed;
  const rng = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const foldSize = Math.ceil(n / k);
  const scores: number[] = [];

  for (let fold = 0; fold < k; fold++) {
    const testStart = fold * foldSize;
    const testEnd = Math.min(testStart + foldSize, n);
    const testIdx = indices.slice(testStart, testEnd);
    const trainIdx = [...indices.slice(0, testStart), ...indices.slice(testEnd)];

    if (trainIdx.length === 0 || testIdx.length === 0) continue;

    const X_train = trainIdx.map(i => X[i]);
    const y_train = trainIdx.map(i => y[i]);
    const X_test = testIdx.map(i => X[i]);
    const y_test = testIdx.map(i => y[i]);

    // Scale based on training data
    const { scaled: X_tr_s, means, stds } = standardScale(X_train);
    const X_te_s = X_test.map(row => row.map((v, j) => (v - means[j]) / stds[j]));

    let preds: number[];

    if (modelType === 'logistic-regression') {
      const model = fitLogisticRegression(X_tr_s, y_train);
      preds = predictLogistic(X_te_s, model.coefficients, model.intercept).predictions;
    } else {
      const model = fitNaiveBayes(X_tr_s, y_train);
      preds = predictNaiveBayes(X_te_s, model).predictions;
    }

    const correct = preds.filter((p, i) => p === y_test[i]).length;
    scores.push(correct / y_test.length);
  }

  return scores;
}

/**
 * K-Fold cross-validation for regression (returns R² scores)
 */
export function kFoldCVRegression(
  X: number[][],
  y: number[],
  k: number,
  seed: number = 42
): number[] {
  const n = X.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  let s = seed;
  const rng = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const foldSize = Math.ceil(n / k);
  const scores: number[] = [];

  for (let fold = 0; fold < k; fold++) {
    const testStart = fold * foldSize;
    const testEnd = Math.min(testStart + foldSize, n);
    const testIdx = indices.slice(testStart, testEnd);
    const trainIdx = [...indices.slice(0, testStart), ...indices.slice(testEnd)];

    if (trainIdx.length < 2 || testIdx.length === 0) continue;

    const X_train = trainIdx.map(i => X[i]);
    const y_train = trainIdx.map(i => y[i]);
    const X_test = testIdx.map(i => X[i]);
    const y_test = testIdx.map(i => y[i]);

    const { scaled: X_tr_s, means, stds } = standardScale(X_train);
    const X_te_s = X_test.map(row => row.map((v, j) => (v - means[j]) / stds[j]));

    const model = fitLinearRegression(X_tr_s, y_train);
    const preds = predictLinear(X_te_s, model.coefficients, model.intercept);
    const metrics = computeRegressionMetrics(y_test, preds);
    scores.push(Math.max(0, metrics.r2)); // Clamp negative R² to 0
  }

  return scores;
}

// ─── Data Preparation from Dashboard ────────────────────────

import type { DashboardMetrics } from '@/types';

export interface FeatureConfig {
  key: string;
  label: string;
  enabled: boolean;
  extract: (data: DashboardMetrics, month: number) => number;
}

export const AVAILABLE_FEATURES: FeatureConfig[] = [
  {
    key: 'admCasualty',
    label: 'Casualty Admissions',
    enabled: true,
    extract: (d, m) => d.admCasualty?.[m] || 0,
  },
  {
    key: 'admInpatient',
    label: 'Inpatient Admissions',
    enabled: true,
    extract: (d, m) => d.admInpatient?.[m] || 0,
  },
  {
    key: 'admDay',
    label: 'Day Admissions',
    enabled: false,
    extract: (d, m) => d.admDay?.[m] || 0,
  },
  {
    key: 'theatreCases',
    label: 'Theatre Cases',
    enabled: true,
    extract: (d, m) => d.theatreCases?.[m] || 0,
  },
  {
    key: 'theatreMinutes',
    label: 'Theatre Minutes',
    enabled: false,
    extract: (d, m) => d.theatreMinutes?.[m] || 0,
  },
  {
    key: 'pharmacyRx',
    label: 'Pharmacy Scripts',
    enabled: true,
    extract: (d, m) => d.pharmacyRx?.[m] || 0,
  },
  {
    key: 'pharmacyRev',
    label: 'Pharmacy Revenue',
    enabled: false,
    extract: (d, m) => d.pharmacyRev?.[m] || 0,
  },
  {
    key: 'occMidnight',
    label: 'Midnight Census',
    enabled: true,
    extract: (d, m) => d.occMidnight?.[m] || 0,
  },
  {
    key: 'epsFinalised',
    label: 'Episodes Finalised',
    enabled: false,
    extract: (d, m) => d.epsFinalised?.[m] || 0,
  },
  {
    key: 'totalPatDays',
    label: 'Total Patient Days',
    enabled: true,
    extract: (d, m) => {
      let total = 0;
      for (const arr of Object.values(d.patDaysWard || {})) total += arr[m] || 0;
      return total;
    },
  },
];

export type TargetType = 'revenue' | 'high-revenue' | 'high-occupancy' | 'high-admissions';

export const TARGET_OPTIONS: { value: TargetType; label: string; isClassification: boolean }[] = [
  { value: 'revenue', label: 'Predict Revenue (Regression)', isClassification: false },
  { value: 'high-revenue', label: 'High Revenue Month (>median)', isClassification: true },
  { value: 'high-occupancy', label: 'High Occupancy Month (>median)', isClassification: true },
  { value: 'high-admissions', label: 'High Admissions Month (>median)', isClassification: true },
];

/**
 * Build the dataset from dashboard metrics
 */
export function buildDataset(
  data: DashboardMetrics,
  enabledFeatures: string[],
  target: TargetType
): MLDataset | null {
  const features = AVAILABLE_FEATURES.filter(f => enabledFeatures.includes(f.key));
  if (features.length === 0) return null;

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Only include months that have data (non-zero revenue or admissions)
  const activeMonths: number[] = [];
  for (let m = 0; m < 12; m++) {
    const rev = data.monthRevenue?.[m] || 0;
    const adm = (data.admCasualty?.[m] || 0) + (data.admInpatient?.[m] || 0) + (data.admDay?.[m] || 0);
    if (rev > 0 || adm > 0) activeMonths.push(m);
  }

  if (activeMonths.length < 3) return null; // Need at least 3 samples

  // Build feature matrix
  const X = activeMonths.map(m => features.map(f => f.extract(data, m)));
  const sampleLabels = activeMonths.map(m => MONTH_NAMES[m]);

  // Build target
  let y: number[];
  if (target === 'revenue') {
    y = activeMonths.map(m => data.monthRevenue?.[m] || 0);
  } else if (target === 'high-revenue') {
    const revenues = activeMonths.map(m => data.monthRevenue?.[m] || 0);
    const median = [...revenues].sort((a, b) => a - b)[Math.floor(revenues.length / 2)];
    y = revenues.map(r => (r >= median ? 1 : 0));
  } else if (target === 'high-occupancy') {
    const occ = activeMonths.map(m => data.occMidnight?.[m] || 0);
    const median = [...occ].sort((a, b) => a - b)[Math.floor(occ.length / 2)];
    y = occ.map(o => (o >= median ? 1 : 0));
  } else {
    // high-admissions
    const adm = activeMonths.map(m =>
      (data.admCasualty?.[m] || 0) + (data.admInpatient?.[m] || 0) + (data.admDay?.[m] || 0)
    );
    const median = [...adm].sort((a, b) => a - b)[Math.floor(adm.length / 2)];
    y = adm.map(a => (a >= median ? 1 : 0));
  }

  return {
    X,
    y,
    featureNames: features.map(f => f.label),
    sampleLabels,
  };
}

/**
 * Compute feature importance from model coefficients (normalized absolute values)
 */
export function computeFeatureImportance(
  coefficients: number[],
  featureNames: string[]
): { feature: string; importance: number }[] {
  const absCoeffs = coefficients.map(Math.abs);
  const total = absCoeffs.reduce((s, v) => s + v, 0) || 1;
  return featureNames
    .map((feature, i) => ({ feature, importance: absCoeffs[i] / total }))
    .sort((a, b) => b.importance - a.importance);
}
