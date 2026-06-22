// Alert classification rules, mirrored in spark/stream.py. Kept as a pure
// function so the thresholds are documented and unit-tested (test/classify.test.js).
//
// Thresholds:
//   airQuality > 200            -> HIGH POLLUTION
//   airQuality > 100            -> MODERATE POLLUTION
//   temperature > 38           -> HEAT WARNING
//   noise > 90                 -> NOISE WARNING
//   otherwise                  -> NORMAL
export function classify(data) {
  if (data.airQuality > 200) return "HIGH POLLUTION";
  if (data.airQuality > 100) return "MODERATE POLLUTION";
  if (data.temperature > 38) return "HEAT WARNING";
  if (data.noise > 90) return "NOISE WARNING";
  return "NORMAL";
}
