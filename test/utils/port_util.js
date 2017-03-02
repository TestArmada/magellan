/* eslint no-undef: 0, no-unused-expressions: 0, no-magic-numbers: 0, callback-return: 0 */
"use strict";
const expect = require("chai").expect;
const portUtil = require("../../src/util/port_util");
const sinon = require("sinon");

describe("port_util", () => {
  it("should get the next port", () => {
    expect(portUtil.getNextPort()).to.eql(12000);
    expect(portUtil.getNextPort()).to.eql(12003);
  });

  it("should acquire a port", () => {
    const spy = sinon.spy();
    portUtil.acquirePort(spy, {
      checkPorts: (arr, cb) => {
        cb([{
          port: arr[0],
          available: true
        }]);
      }
    });
    expect(spy.called).to.be.true;
  });

  it("should acquire a port after a retry", () => {
    const spy = sinon.spy();
    let attempt = 0;
    portUtil.acquirePort(spy, {
      checkPorts: (arr, cb) => {
        attempt === 0 ? cb([{
          port: arr[0],
          available: false
        }]) : cb([{
          port: arr[0],
          available: true
        }]);
        attempt = 1;
      }
    });
    expect(spy.called).to.be.true;
  });
});
