/* eslint no-undef: 0, no-magic-numbers: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const checkPorts = require("../../src/util/check_ports");
const sinon = require("sinon");

describe("check_ports", () => {
  it("should check some ports", () => {
    const spy = sinon.spy();
    checkPorts([10, 20, 30], spy,
      {
        request: (opts, cb) => {
          cb(null);
        },
        console: {log: () => {}}
      });
    expect(spy.called).to.be.true;
  });

  it("should check find ports", () => {
    const spy = sinon.spy();
    checkPorts([10, 20, 30], spy,
      {
        request: (opts, cb) => {
          cb({code: "ECONNREFUSED"});
        },
        portscanner: {
          checkPortStatus: (port, host, cb) => {
            cb(null, "open");
          }
        },
        console: {log: () => {}}
      });
    expect(spy.called).to.be.true;
  });
});
