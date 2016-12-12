/* eslint no-undef: 0, no-magic-numbers: 0, no-unused-expressions: 0 */
"use strict";
var expect = require("chai").expect;
var checkPorts = require("../../src/util/check_ports");
var sinon = require("sinon");

describe("check_ports", function () {
  it("should check some ports", function () {
    var spy = sinon.spy();
    checkPorts([10, 20, 30], spy,
      {
        request: function (opts, cb) {
          cb(null);
        },
        console: {log: function () {}}
      });
    expect(spy.called).to.be.true;
  });

  it("should check find ports", function () {
    var spy = sinon.spy();
    checkPorts([10, 20, 30], spy,
      {
        request: function (opts, cb) {
          cb({code: "ECONNREFUSED"});
        },
        portscanner: {
          checkPortStatus: function (port, host, cb) {
            cb(null, "open");
          }
        },
        console: {log: function () {}}
      });
    expect(spy.called).to.be.true;
  });
});
