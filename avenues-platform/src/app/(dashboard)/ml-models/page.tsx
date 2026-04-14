'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  Cell,
  ReferenceLine,
} from 'recharts';
import { Brain, AlertCircle, Play, RotateCcw } from 'lucide-react';
import { useDashboard } from '@/store';
import { formatCurrency } from '@/lib/utils';
import {
  AVAILABLE_FEATURES,
  TARGET_OPTIONS,
  buildDataset,
  standardScale,
  trainTestSplit,
  fitLinearRegression,
  predictLinear,
  computeRegressionMetrics,
  fitLogisticRegression,
  predictLogistic,
  fitNaiveBayes,
  predictNaiveBayes,
  computeClassificationMetrics,
  computeROCCurve,
  computeFeatureImportance,
  kFoldCV,
  kFoldCVRegression,
  type TrainedModel,
  type TargetType,
} from '@/lib/ml';

type ModelType = 'linear-regression' | 'logistic-regression' | 'naive-bayes';

const MODEL_OPTIONS: { value: ModelType; label: string; isClassification: boolean }[] = [
  { value: 'linear-regression', label: 'Linear Regression', isClassification: false },
  { value: 'logistic-regression', label: 'Logistic Regression', isClassification: true },
  { value: 'naive-bayes', label: 'Naive Bayes', isClassification: true },
];

export default function MLModelsPage() {
  const dashboardData = useDashboard();

  // Controls
  const [selectedModel, setSelectedModel] = useState<ModelType>('logistic-regression');
  const [selectedTarget, setSelectedTarget] = useState<TargetType>('high-revenue');
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>(
    AVAILABLE_FEATURES.filter(f => f.enabled).map(f => f.key)
  );
  const [splitRatio, setSplitRatio] = useState(70);
  const [cvFolds, setCvFolds] = useState(3);

  // Trained model state
  const [trainedModel, setTrainedModel] = useState<TrainedModel | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingLog, setTrainingLog] = useState<string[]>([]);

  const isClassification = MODEL_OPTIONS.find(m => m.value === selectedModel)?.isClassification ?? true;

  // Auto-select appropriate target when model changes
  const effectiveTarget = useMemo(() => {
    const targetIsClassification = TARGET_OPTIONS.find(t => t.value === selectedTarget)?.isClassification ?? true;
    if (isClassification && !targetIsClassification) return 'high-revenue';
    if (!isClassification && targetIsClassification) return 'revenue';
    return selectedTarget;
  }, [selectedModel, selectedTarget, isClassification]);

  const toggleFeature = (key: string) => {
    setEnabledFeatures(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(k => k !== key) : prev
        : [...prev, key]
    );
  };

  // Build dataset from real dashboard data
  const dataset = useMemo(() => {
    if (!dashboardData) return null;
    return buildDataset(dashboardData, enabledFeatures, effectiveTarget);
  }, [dashboardData, enabledFeatures, effectiveTarget]);

  // Train the model
  const handleTrain = useCallback(() => {
    if (!dataset) return;
    setIsTraining(true);
    setTrainingLog([]);
    const log: string[] = [];

    // Use setTimeout to let UI update
    setTimeout(() => {
      const startTime = performance.now();

      log.push(`Dataset: ${dataset.X.length} samples x ${dataset.featureNames.length} features`);
      if (dataset.sampleWarning) {
        log.push(`⚠️ ${dataset.sampleWarning}`);
      }
      log.push(`Target: ${TARGET_OPTIONS.find(t => t.value === effectiveTarget)?.label}`);
      log.push(`Model: ${MODEL_OPTIONS.find(m => m.value === selectedModel)?.label}`);

      // Scale features
      const { scaled } = standardScale(dataset.X);
      log.push(`Features scaled (mean=0, std=1)`);

      // Split
      const split = trainTestSplit(scaled, dataset.y, splitRatio / 100);
      log.push(`Split: ${split.X_train.length} train / ${split.X_test.length} test`);

      let model: TrainedModel;

      if (selectedModel === 'linear-regression') {
        // Linear Regression
        const lr = fitLinearRegression(split.X_train, split.y_train);
        const trainPreds = predictLinear(split.X_train, lr.coefficients, lr.intercept);
        const testPreds = predictLinear(split.X_test, lr.coefficients, lr.intercept);
        const allPreds = predictLinear(scaled, lr.coefficients, lr.intercept);

        const trainMetrics = computeRegressionMetrics(split.y_train, trainPreds);
        const testMetrics = computeRegressionMetrics(split.y_test, testPreds);
        log.push(`Train R2: ${(trainMetrics.r2 * 100).toFixed(1)}%`);
        log.push(`Test R2: ${(testMetrics.r2 * 100).toFixed(1)}%`);

        // Cross-validation
        const folds = Math.min(cvFolds, dataset.X.length);
        const cvScores = kFoldCVRegression(scaled, dataset.y, folds);
        log.push(`${folds}-Fold CV R2: ${cvScores.map(s => (s * 100).toFixed(1) + '%').join(', ')}`);

        const featureImportance = computeFeatureImportance(lr.coefficients, dataset.featureNames);

        model = {
          type: 'linear-regression',
          coefficients: lr.coefficients,
          intercept: lr.intercept,
          featureImportance,
          regressionMetrics: testMetrics,
          predictions: allPreds,
          actualValues: dataset.y,
          trainingTime: performance.now() - startTime,
          samplesUsed: split.X_train.length,
          cvScores,
        };
      } else if (selectedModel === 'logistic-regression') {
        // Logistic Regression
        const lr = fitLogisticRegression(split.X_train, split.y_train);
        const { predictions: testPreds, probabilities: testProbs } =
          predictLogistic(split.X_test, lr.coefficients, lr.intercept);
        const { predictions: allPreds, probabilities: allProbs } =
          predictLogistic(scaled, lr.coefficients, lr.intercept);

        const metrics = computeClassificationMetrics(split.y_test, testPreds, testProbs);
        const rocCurve = computeROCCurve(split.y_test, testProbs);

        log.push(`Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
        log.push(`AUC: ${metrics.auc.toFixed(3)}`);

        // Cross-validation
        const folds = Math.min(cvFolds, dataset.X.length);
        const cvScores = kFoldCV(scaled, dataset.y, folds, 'logistic-regression');
        log.push(`${folds}-Fold CV: ${cvScores.map(s => (s * 100).toFixed(1) + '%').join(', ')}`);

        const featureImportance = computeFeatureImportance(lr.coefficients, dataset.featureNames);

        model = {
          type: 'logistic-regression',
          coefficients: lr.coefficients,
          intercept: lr.intercept,
          featureImportance,
          classificationMetrics: metrics,
          rocCurve,
          predictions: allPreds,
          probabilities: allProbs,
          actualValues: dataset.y,
          trainingTime: performance.now() - startTime,
          samplesUsed: split.X_train.length,
          cvScores,
        };
      } else {
        // Naive Bayes
        const nb = fitNaiveBayes(split.X_train, split.y_train);
        const { predictions: testPreds, probabilities: testProbs } =
          predictNaiveBayes(split.X_test, nb);
        const { predictions: allPreds, probabilities: allProbs } =
          predictNaiveBayes(scaled, nb);

        const metrics = computeClassificationMetrics(split.y_test, testPreds, testProbs);
        const rocCurve = computeROCCurve(split.y_test, testProbs);

        log.push(`Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
        log.push(`AUC: ${metrics.auc.toFixed(3)}`);

        // Cross-validation
        const folds = Math.min(cvFolds, dataset.X.length);
        const cvScores = kFoldCV(scaled, dataset.y, folds, 'naive-bayes');
        log.push(`${folds}-Fold CV: ${cvScores.map(s => (s * 100).toFixed(1) + '%').join(', ')}`);

        // NB feature importance via class separation
        const importances = dataset.featureNames.map((name, j) => {
          const class0Var = nb.classVars[0]?.[j] || 1;
          const class1Var = nb.classVars[1]?.[j] || 1;
          const meanDiff = Math.abs((nb.classMeans[1]?.[j] || 0) - (nb.classMeans[0]?.[j] || 0));
          return { feature: name, importance: meanDiff / Math.sqrt(class0Var + class1Var) };
        });
        const totalImp = importances.reduce((s, i) => s + i.importance, 0) || 1;
        const featureImportance = importances
          .map(i => ({ ...i, importance: i.importance / totalImp }))
          .sort((a, b) => b.importance - a.importance);

        model = {
          type: 'naive-bayes',
          coefficients: [],
          intercept: 0,
          featureImportance,
          classificationMetrics: metrics,
          rocCurve,
          predictions: allPreds,
          probabilities: allProbs,
          actualValues: dataset.y,
          trainingTime: performance.now() - startTime,
          samplesUsed: split.X_train.length,
          cvScores,
        };
      }

      log.push(`Training complete in ${model.trainingTime.toFixed(1)}ms`);
      setTrainingLog(log);
      setTrainedModel(model);
      setIsTraining(false);
    }, 50);
  }, [dataset, selectedModel, effectiveTarget, splitRatio, cvFolds]);

  const handleReset = () => {
    setTrainedModel(null);
    setTrainingLog([]);
  };

  // Empty state
  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Brain className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">ML Models</h1>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">No Data Loaded</h2>
            <p className="mt-2 text-sm text-gray-500 max-w-md">Upload CSV data to train models on your hospital metrics.</p>
            <a href="/upload" className="mt-4 text-sm font-medium text-teal-600 hover:text-teal-700">Go to Upload →</a>
          </div>
        </div>
      </div>
    );
  }

  const cm = trainedModel?.classificationMetrics?.confusionMatrix;
  const regMetrics = trainedModel?.regressionMetrics;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ML Models</h1>
            <p className="text-sm text-gray-500 mt-1">
              Train real models on your hospital data &middot; {dataset?.X.length ?? 0} active month samples
            </p>
          </div>
        </div>

        {/* Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Model Selector */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => { setSelectedModel(e.target.value as ModelType); handleReset(); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {MODEL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Target Selector */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Target</label>
            <select
              value={effectiveTarget}
              onChange={(e) => { setSelectedTarget(e.target.value as TargetType); handleReset(); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {TARGET_OPTIONS
                .filter(t => isClassification ? t.isClassification : !t.isClassification)
                .map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
          </div>

          {/* Train/Test Split */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Split: {splitRatio}/{100 - splitRatio}
            </label>
            <input
              type="range" min="50" max="90" step="10"
              value={splitRatio}
              onChange={(e) => { setSplitRatio(parseInt(e.target.value)); handleReset(); }}
              className="w-full mt-2"
            />
          </div>

          {/* CV Folds */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              CV Folds: {cvFolds}
            </label>
            <input
              type="range" min="2" max={Math.min(5, dataset?.X.length || 3)} step="1"
              value={cvFolds}
              onChange={(e) => { setCvFolds(parseInt(e.target.value)); handleReset(); }}
              className="w-full mt-2"
            />
          </div>

          {/* Train Button */}
          <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col justify-center">
            <button
              onClick={trainedModel ? handleReset : handleTrain}
              disabled={isTraining || !dataset || dataset.X.length < 3}
              className={`w-full flex items-center justify-center gap-2 font-medium py-2.5 px-4 rounded-lg transition-all text-sm ${
                trainedModel
                  ? 'bg-gray-600 hover:bg-gray-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300'
              }`}
            >
              {trainedModel ? (
                <><RotateCcw className="w-4 h-4" /> Reset</>
              ) : isTraining ? (
                'Training...'
              ) : (
                <><Play className="w-4 h-4" /> Train Model</>
              )}
            </button>
            {dataset && dataset.X.length < 3 && (
              <p className="text-xs text-red-500 mt-1 text-center">Need 3+ months of data</p>
            )}
          </div>
        </div>

        {/* Feature Selection */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Features ({enabledFeatures.length} selected)
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_FEATURES.map(f => (
              <button
                key={f.key}
                onClick={() => { toggleFeature(f.key); handleReset(); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  enabledFeatures.includes(f.key)
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Training Log */}
        {trainingLog.length > 0 && (
          <div className="bg-gray-900 rounded-lg shadow-sm p-4 font-mono text-xs text-green-400 max-h-40 overflow-y-auto">
            {trainingLog.map((line, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-gray-500 select-none">[{i + 1}]</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {trainedModel && (
          <>
            {/* Classification Metrics */}
            {trainedModel.classificationMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <MetricCard label="Accuracy" value={`${(trainedModel.classificationMetrics.accuracy * 100).toFixed(1)}%`} color="blue" />
                <MetricCard label="Precision" value={`${(trainedModel.classificationMetrics.precision * 100).toFixed(1)}%`} color="green" />
                <MetricCard label="Recall" value={`${(trainedModel.classificationMetrics.recall * 100).toFixed(1)}%`} color="orange" />
                <MetricCard label="F1 Score" value={`${(trainedModel.classificationMetrics.f1Score * 100).toFixed(1)}%`} color="purple" />
                <MetricCard label="AUC" value={trainedModel.classificationMetrics.auc.toFixed(3)} color="red" />
              </div>
            )}

            {/* Regression Metrics */}
            {regMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="R2 Score" value={`${(regMetrics.r2 * 100).toFixed(1)}%`} color="blue" />
                <MetricCard label="MAE" value={formatCurrency(regMetrics.mae)} color="green" />
                <MetricCard label="RMSE" value={formatCurrency(regMetrics.rmse)} color="orange" />
                <MetricCard label="MAPE" value={`${regMetrics.mape.toFixed(1)}%`} color="purple" />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Confusion Matrix */}
              {cm && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">Confusion Matrix</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200 text-center">
                      <p className="text-xs text-green-700 font-medium">True Positive</p>
                      <p className="text-3xl font-bold text-green-700 mt-1">{cm.TP}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200 text-center">
                      <p className="text-xs text-red-700 font-medium">False Positive</p>
                      <p className="text-3xl font-bold text-red-700 mt-1">{cm.FP}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200 text-center">
                      <p className="text-xs text-green-700 font-medium">True Negative</p>
                      <p className="text-3xl font-bold text-green-700 mt-1">{cm.TN}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200 text-center">
                      <p className="text-xs text-red-700 font-medium">False Negative</p>
                      <p className="text-3xl font-bold text-red-700 mt-1">{cm.FN}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    Test samples: {cm.TP + cm.FP + cm.TN + cm.FN}
                  </p>
                </div>
              )}

              {/* Cross-Validation */}
              {trainedModel.cvScores && trainedModel.cvScores.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">
                    {trainedModel.cvScores.length}-Fold Cross-Validation
                  </h2>
                  <div className="space-y-3">
                    {trainedModel.cvScores.map((score, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-600 w-14">Fold {idx + 1}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-3 rounded-full transition-all ${score >= 0.7 ? 'bg-blue-500' : score >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.max(0, score) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                          {(score * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-700">
                        Average:{' '}
                        <span className="font-bold text-blue-600">
                          {(trainedModel.cvScores.reduce((a, b) => a + b, 0) / trainedModel.cvScores.length * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({isClassification ? 'accuracy' : 'R2'})
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ROC Curve */}
              {trainedModel.rocCurve && trainedModel.rocCurve.length > 2 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">
                    ROC Curve (AUC = {trainedModel.classificationMetrics?.auc.toFixed(3)})
                  </h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trainedModel.rocCurve} margin={{ top: 5, right: 20, bottom: 25, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="fpr" type="number" domain={[0, 1]}
                        label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -15 }}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="tpr" type="number" domain={[0, 1]}
                        label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', offset: 0 }}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={(v) => Number(v).toFixed(3)} />
                      <Line type="monotone" dataKey="tpr" stroke="#3b82f6" strokeWidth={2} dot={false} name="Model" />
                      <ReferenceLine
                        segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                        stroke="#d1d5db"
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Actual vs Predicted (regression) */}
              {regMetrics && dataset && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">Actual vs Predicted Revenue</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ top: 5, right: 20, bottom: 25, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="actual" type="number" name="Actual"
                        label={{ value: 'Actual', position: 'insideBottom', offset: -15 }}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                      />
                      <YAxis
                        dataKey="predicted" type="number" name="Predicted"
                        label={{ value: 'Predicted', angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                      />
                      <Tooltip
                        formatter={(v) => formatCurrency(Number(v))}
                        labelFormatter={(l) => `Actual: ${formatCurrency(Number(l))}`}
                      />
                      <Scatter
                        name="Months"
                        data={trainedModel.actualValues.map((actual, i) => ({
                          actual,
                          predicted: trainedModel.predictions[i],
                          label: dataset.sampleLabels[i],
                        }))}
                        fill="#3b82f6"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Feature Importance */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Feature Importance</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={trainedModel.featureImportance}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                    <YAxis dataKey="feature" type="category" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                    <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                      {trainedModel.featureImportance.map((_, i) => (
                        <Cell key={i} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'][i % 10]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Predictions per Month */}
              {dataset && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">Predictions by Month</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={dataset.sampleLabels.map((label, i) => ({
                        month: label,
                        actual: trainedModel.actualValues[i],
                        predicted: isClassification
                          ? (trainedModel.probabilities?.[i] ?? trainedModel.predictions[i])
                          : trainedModel.predictions[i],
                      }))}
                      margin={{ top: 5, right: 20, bottom: 5, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }}
                        tickFormatter={isClassification ? (v) => `${(v * 100).toFixed(0)}%` : (v) => `$${(v / 1000).toFixed(0)}K`}
                      />
                      <Tooltip
                        formatter={(v) =>
                          isClassification ? `${(Number(v) * 100).toFixed(1)}%` : formatCurrency(Number(v))
                        }
                      />
                      <Legend />
                      <Bar dataKey="actual" fill="#94a3b8" name="Actual" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="predicted" fill="#3b82f6" name="Predicted" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Model Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg shadow-sm p-4 border border-blue-200">
                <p className="text-xs font-medium text-blue-800">Training Time</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{trainedModel.trainingTime.toFixed(1)}ms</p>
              </div>
              <div className="bg-green-50 rounded-lg shadow-sm p-4 border border-green-200">
                <p className="text-xs font-medium text-green-800">Training Samples</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{trainedModel.samplesUsed}</p>
              </div>
              <div className="bg-purple-50 rounded-lg shadow-sm p-4 border border-purple-200">
                <p className="text-xs font-medium text-purple-800">Features Used</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{enabledFeatures.length}</p>
              </div>
            </div>
          </>
        )}

        {/* No model trained yet */}
        {!trainedModel && !isTraining && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700">Configure &amp; Train</h2>
            <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
              Select a model, choose features and target variable, then click Train Model to run
              real machine learning on your hospital data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
    purple: 'text-purple-600',
    red: 'text-red-600',
  };
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <p className="text-xs text-gray-600 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorMap[color] || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
