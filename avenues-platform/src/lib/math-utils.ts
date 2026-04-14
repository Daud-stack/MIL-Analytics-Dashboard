/**
 * Shared mathematical and statistical utilities
 */

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Simple linear trend forecasting using least squares
 */
export function linearForecast(data: number[], forecastMonths: number = 6): { value: number; upper: number; lower: number }[] {
  if (data.length < 2) return data.map(v => ({ value: v, upper: v, lower: v }));

  // Calculate slope using least squares
  const n = data.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  const meanX = indices.reduce((a, b) => a + b, 0) / n;
  const meanY = data.reduce((a, b) => a + b, 0) / n;

  const numerator = indices.reduce((sum, x, i) => sum + (x - meanX) * (data[i] - meanY), 0);
  const denominator = indices.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0);
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;

  // Calculate residual standard error
  const residuals = data.map((val, i) => val - (intercept + slope * i));
  const sse = residuals.reduce((sum, r) => sum + r * r, 0);
  const residualSE = Math.sqrt(sse / Math.max(n - 2, 1));

  // Sum of squared deviations of x from mean (for prediction interval correction)
  const ssx = indices.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0);

  // Generate forecast points with proper prediction intervals
  const forecast = [];
  for (let i = 0; i < forecastMonths; i++) {
    const x = n + i;
    const value = intercept + slope * x;
    const predictionFactor = Math.sqrt(1 + 1/n + Math.pow(x - meanX, 2) / (ssx || 1));
    const margin = 1.96 * residualSE * predictionFactor;
    forecast.push({
      value: Math.max(value, 0),
      upper: value + margin,
      lower: Math.max(value - margin, 0)
    });
  }

  return forecast;
}

/**
 * Calculate Z-Score for a value in a series
 */
export function calculateZScore(value: number, series: number[]): number {
  if (series.length < 2) return 0;
  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const variance = series.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance) || 1;
  return (value - mean) / std;
}
