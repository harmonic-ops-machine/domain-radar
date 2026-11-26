export interface BacktestSample {
  domainId: number;
  predicted12mGrowthPct: number;
  actualGrowthPct: number;
  actuallyAbsorbed: boolean;
}

export interface BacktestReport {
  sampleSize: number;
  mapePct: number;
  baselineMapePct: number;
  precisionAtK: number;
  beatsBaseline: boolean;
}

export function evaluateBacktest(samples: BacktestSample[]): BacktestReport {
  if (samples.length === 0) {
    return {
      sampleSize: 0,
      mapePct: 0,
      baselineMapePct: 0,
      precisionAtK: 0,
      beatsBaseline: false,
    };
  }

  let absErrSum = 0;
  let baselineErrSum = 0;
  for (const s of samples) {
    const denom = Math.max(10, Math.abs(s.actualGrowthPct));
    absErrSum += (Math.abs(s.predicted12mGrowthPct - s.actualGrowthPct) / denom) * 100;
    baselineErrSum += (Math.abs(0 - s.actualGrowthPct) / denom) * 100;
  }

  const mapePct = Number((absErrSum / samples.length).toFixed(2));
  const baselineMapePct = Number((baselineErrSum / samples.length).toFixed(2));

  const k = Math.min(20, samples.length);
  const topK = [...samples]
    .sort((a, b) => b.predicted12mGrowthPct - a.predicted12mGrowthPct)
    .slice(0, k);
  const hits = topK.filter((s) => s.actuallyAbsorbed).length;
  const precisionAtK = Number((hits / k).toFixed(3));

  return {
    sampleSize: samples.length,
    mapePct,
    baselineMapePct,
    precisionAtK,
    beatsBaseline: mapePct < baselineMapePct,
  };
}
