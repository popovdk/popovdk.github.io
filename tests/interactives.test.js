import test from 'node:test';
import assert from 'node:assert/strict';
import { bayesCounts, normalizeAllocation, rebalanceAllocation, allocationMetrics, maximumUtilityAllocation } from '../src/interactives/calculations.js';

test('Bayes: rare events can produce more false than true alerts', () => {
  const result = bayesCounts(1, 90, 5);
  assert.equal(result.truePositive, 90);
  assert.equal(result.falsePositive, 495);
  assert.ok(Math.abs(result.posterior - 90 / 585) < 1e-12);
  assert.ok(Math.abs(result.truePositive + result.falsePositive + result.falseNegative + result.trueNegative - 10000) < 1e-8);
});

test('Bayes handles no alerts, perfect specificity and every message being spam', () => {
  assert.equal(bayesCounts(0, 100, 0).posterior, null);
  assert.equal(bayesCounts(10, 100, 0).posterior, 1);
  assert.equal(bayesCounts(100, 80, 50).posterior, 1);
  assert.equal(bayesCounts(0, 90, 10).posterior, 0);
});

test('Every allocation change conserves all 100 units, including extreme and malformed values', () => {
  for (const original of [[33, 33, 34], [100, 0, 0], [0, 100, 0], [0, 0, 0], [40, 40, 40], ['bad', Infinity, -30]]) {
    for (let person = 0; person < 3; person++) {
      for (const next of [0, 1, 33, 99, 100, -20, 200, NaN]) {
        const result = rebalanceAllocation(original, person, next);
        assert.equal(result.reduce((sum, item) => sum + item, 0), 100);
        assert.ok(result.every(item => Number.isInteger(item) && item >= 0 && item <= 100));
      }
    }
  }
  assert.deepEqual(normalizeAllocation(null), [33, 33, 34]);
});

test('Utility presets distinguish resource equality from the chosen utility model', () => {
  const equalOptimum = maximumUtilityAllocation([1, 1, 1]);
  assert.ok(Math.max(...equalOptimum) - Math.min(...equalOptimum) <= 1);
  const unequalOptimum = maximumUtilityAllocation([1, 1.5, 2]);
  assert.deepEqual(unequalOptimum, [14, 31, 55]);
  assert.ok(allocationMetrics(unequalOptimum, [1, 1.5, 2]).utility > allocationMetrics([33, 33, 34], [1, 1.5, 2]).utility);
  assert.ok(allocationMetrics(unequalOptimum).minimum < allocationMetrics([33, 33, 34]).minimum);
});
