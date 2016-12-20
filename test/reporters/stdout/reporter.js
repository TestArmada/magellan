/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
var expect = require("chai").expect;
var Reporter = require("../../../src/reporters/stdout/reporter");
var sinon = require("sinon");

describe("STDOUT Reporter", function () {
  it("should be a listener", function () {
    var r = new Reporter();
    expect(r.initialize).to.not.be.null;
    expect(r.listenTo).to.not.be.null;
    expect(r.flush).to.not.be.null;
    var spy = sinon.spy();
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
