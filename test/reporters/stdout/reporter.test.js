/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";

const Reporter = require("../../../src/reporters/stdout/reporter");
const sinon = require("sinon");

describe("STDOUT Reporter", () => {
  it("should be a listener", () => {

    const r = new Reporter();
    expect(r.initialize).not.toBeNull();
    expect(r.listenTo).not.toBeNull();
    expect(r.flush).not.toBeNull();

    const spy = sinon.spy();

    r.listenTo(null, null, {
      stdout: {
        pipe: spy
      },
      stderr: {
        pipe: spy
      }
    });
    expect(spy.called).toBeTruthy();
  });
});
