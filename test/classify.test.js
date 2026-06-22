import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../backend/processor/classify.js";

const base = { sensorId: "sensor-1", temperature: 20, humidity: 50, airQuality: 50, noise: 50 };

test("normal reading -> NORMAL", () => {
  assert.equal(classify(base), "NORMAL");
});

test("airQuality > 200 -> HIGH POLLUTION", () => {
  assert.equal(classify({ ...base, airQuality: 250 }), "HIGH POLLUTION");
});

test("airQuality > 100 -> MODERATE POLLUTION", () => {
  assert.equal(classify({ ...base, airQuality: 150 }), "MODERATE POLLUTION");
});

test("temperature > 38 -> HEAT WARNING", () => {
  assert.equal(classify({ ...base, temperature: 39 }), "HEAT WARNING");
});

test("noise > 90 -> NOISE WARNING", () => {
  assert.equal(classify({ ...base, noise: 95 }), "NOISE WARNING");
});

test("pollution takes priority over heat", () => {
  assert.equal(classify({ ...base, airQuality: 250, temperature: 45 }), "HIGH POLLUTION");
});

test("boundary: airQuality exactly 200 is not HIGH", () => {
  assert.equal(classify({ ...base, airQuality: 200 }), "MODERATE POLLUTION");
});
