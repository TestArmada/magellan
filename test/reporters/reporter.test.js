/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";

const Reporter = require("../../src/reporters/reporter");

describe("Reporter", () => {
  test("should be a listener", () => {
    const r = new Reporter();
    expect(r.initialize).not.toBeNull();
    expect(r.listenTo).not.toBeNull();
    expect(r.flush).not.toBeNull();
  });

  test("should initialize", () => {
    const r = new Reporter();
    return expect(r.initialize()).resolves.toBe(undefined);
  });

  test("should flush", () => {
    const r = new Reporter();
    return expect(r.flush()).resolves.toBe(undefined);
  });

  test("should listenTo", () => {
    const r = new Reporter();
    r.listenTo();
  });
});
