/**
 * Custom K-Means Clustering Implementation
 */

export interface ClusterPoint {
  id: string;
  features: number[];
  label: string;
  cluster?: number;
}

export interface Centroid {
  features: number[];
  cluster: number;
}

export function kMeans(
  points: ClusterPoint[],
  k: number,
  maxIterations: number = 20
): { clusters: ClusterPoint[]; centroids: Centroid[]; iterations: number } {
  if (points.length < k) {
    return { clusters: points, centroids: [], iterations: 0 };
  }

  // 1. Initial Centroids (Random points from the dataset)
  let centroids: Centroid[] = points
    .slice(0, k)
    .map((p, i) => ({ features: [...p.features], cluster: i }));

  let iterations = 0;
  let changed = true;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // 2. Assignment Step
    points.forEach((p) => {
      let minDist = Infinity;
      let bestCluster = 0;

      centroids.forEach((c) => {
        const dist = euclideanDistance(p.features, c.features);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c.cluster;
        }
      });

      if (p.cluster !== bestCluster) {
        p.cluster = bestCluster;
        changed = true;
      }
    });

    // 3. Update Step
    const newCentroids: Centroid[] = Array.from({ length: k }, (_, i) => ({
      features: new Array(points[0].features.length).fill(0),
      cluster: i,
      count: 0
    }) as any);

    points.forEach((p) => {
      if (p.cluster !== undefined) {
        const c = newCentroids[p.cluster] as any;
        c.count++;
        p.features.forEach((f, i) => (c.features[i] += f));
      }
    });

    newCentroids.forEach((c: any) => {
      if (c.count > 0) {
        c.features = c.features.map((f: number) => f / c.count);
      }
    });

    centroids = newCentroids;
  }

  return { clusters: points, centroids, iterations };
}

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

/**
 * Normalizes features to 0-1 range for fair clustering
 */
export function normalizePoints(points: ClusterPoint[]): ClusterPoint[] {
  if (points.length === 0) return points;
  const dim = points[0].features.length;
  const mins = new Array(dim).fill(Infinity);
  const maxs = new Array(dim).fill(-Infinity);

  points.forEach((p) => {
    p.features.forEach((f, i) => {
      if (f < mins[i]) mins[i] = f;
      if (f > maxs[i]) maxs[i] = f;
    });
  });

  return points.map((p) => ({
    ...p,
    features: p.features.map((f, i) => {
      const range = maxs[i] - mins[i];
      return range === 0 ? 0 : (f - mins[i]) / range;
    })
  }));
}
