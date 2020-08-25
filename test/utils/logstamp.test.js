/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";

const logstamp = require("../../src/util/logstamp");

test("should create a logstamp", () => {
  expect(logstamp()).not.toBeNull();
});
