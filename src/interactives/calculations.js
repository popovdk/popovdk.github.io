/** Pure calculations used by the explanatory widgets. No model is a moral score. */
export function clampNumber(value, min, max, fallback = min) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function bayesCounts(prevalence, sensitivity, falsePositiveRate, population = 10000) {
  const base = clampNumber(prevalence, 0, 100) / 100;
  const sensitivityRate = clampNumber(sensitivity, 0, 100) / 100;
  const falseRate = clampNumber(falsePositiveRate, 0, 100) / 100;
  const total = clampNumber(population, 0, 1e9);
  const truePositive = total * base * sensitivityRate;
  const falseNegative = total * base * (1 - sensitivityRate);
  const falsePositive = total * (1 - base) * falseRate;
  const trueNegative = total * (1 - base) * (1 - falseRate);
  const flagged = truePositive + falsePositive;
  return { truePositive, falseNegative, falsePositive, trueNegative, flagged, total,
    posterior: flagged > 0 ? truePositive / flagged : null };
}

export function normalizeAllocation(value) {
  if (!Array.isArray(value) || value.length !== 3) return [33, 33, 34];
  const safe = value.map(item => Math.round(clampNumber(item, 0, 100)));
  const sum = safe.reduce((total, item) => total + item, 0);
  if (sum === 100) return safe;
  if (sum === 0) return [33, 33, 34];
  const scaled = safe.map(item => item * 100 / sum);
  const normalized = scaled.map(Math.floor);
  let left = 100 - normalized.reduce((total, item) => total + item, 0);
  const order = scaled.map((item, index) => ({ index, fraction: item - normalized[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < left; i++) normalized[order[i % 3].index]++;
  return normalized;
}

/** Change one share; distribute the remainder proportionally between the other two. */
export function rebalanceAllocation(allocation, index, next) {
  const safe = normalizeAllocation(allocation);
  const target = Math.round(clampNumber(index, 0, 2));
  const amount = Math.round(clampNumber(next, 0, 100));
  const others = [0, 1, 2].filter(item => item !== target);
  const remaining = 100 - amount;
  const otherTotal = safe[others[0]] + safe[others[1]];
  const first = otherTotal ? Math.round(remaining * safe[others[0]] / otherTotal) : Math.floor(remaining / 2);
  safe[target] = amount;
  safe[others[0]] = first;
  safe[others[1]] = remaining - first;
  return safe;
}

export function allocationMetrics(allocation, coefficients = [1, 1, 1]) {
  const shares = normalizeAllocation(allocation);
  const utility = shares.reduce((total, share, index) => total + Math.sqrt(share) * coefficients[index], 0);
  return { utility, minimum: Math.min(...shares), gap: Math.max(...shares) - Math.min(...shares), total: 100 };
}

/** Exact optimum over the 5,151 integer allocations, for this toy utility function only. */
export function maximumUtilityAllocation(coefficients = [1, 1, 1]) {
  let best = [0, 0, 100];
  let bestUtility = -Infinity;
  for (let a = 0; a <= 100; a++) {
    for (let b = 0; b <= 100 - a; b++) {
      const values = [a, b, 100 - a - b];
      const utility = values.reduce((sum, item, index) => sum + Math.sqrt(item) * coefficients[index], 0);
      if (utility > bestUtility + 1e-12) { bestUtility = utility; best = values; }
    }
  }
  return best;
}
