/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
var expect = require("chai").expect;
var Settings = require("../../../src/reporters/screenshot_aggregator/settings");

describe("ScreenshotAggregator Settings", function () {
  it("should initialize", function () {
    expect(Settings.hasOwnProperty("aggregatorURL")).to.be.true;
  });
});
