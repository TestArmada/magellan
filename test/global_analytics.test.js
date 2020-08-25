"use strict";

const _ = require("lodash");
const globalAnalytics = require("../src/global_analytics");
const EventEmitter = require("events").EventEmitter;
test("push should work with marker name", () => {
  globalAnalytics.push("eventName", { code: 0 }, "magellan-run");
});


test("push should work without marker name", () => {
  globalAnalytics.push("eventName", { code: 0 });
});

test("makr should work with marker name", () => {
  globalAnalytics.mark("eventName", "magellan-run");
});

test("makr should work without marker name", () => {
  globalAnalytics.mark("eventName");
});

test("sync", () => {
  expect(globalAnalytics.sync()).toBeInstanceOf(Array);
});
test("get emitter", () => {
  expect(globalAnalytics.getEmitter()).toBeInstanceOf(EventEmitter);
});