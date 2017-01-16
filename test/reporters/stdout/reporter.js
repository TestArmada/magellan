/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const Reporter = require("../../../src/reporters/stdout/reporter");
const sinon = require("sinon");

describe("STDOUT Reporter", () => {
  it("should be a listener", () => {
    const r = new Reporter();
    expect(r.initialize).to.not.be.null;
    expect(r.listenTo).to.not.be.null;
    expect(r.flush).to.not.be.null;
    const spy = sinon.spy();
    r.listenTo(null, null, {
      stdout: {
        pipe: spy
      },
      stderr: {
        pipe: spy
      }
    });
    expect(spy.called).to.be.true;
    r.listenTo(null, null, {
      stderr: {
        pipe: spy
      }
    });
    r.listenTo(null, null, {
      stdout: {
        pipe: spy
      }
    });
  });
});
