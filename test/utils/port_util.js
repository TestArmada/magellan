/* eslint no-undef: 0, no-unused-expressions: 0, no-magic-numbers: 0, callback-return: 0 */
"use strict";
var expect = require("chai").expect;
var portUtil = require("../../src/util/port_util");
var sinon = require("sinon");

describe("port_util", function () {
  it("should get the next port", function () {
    expect(portUtil.getNextPort()).to.eql(12009);
    expect(portUtil.getNextPort()).to.eql(12012);
  });

  it("should acquire a port", function () {
    var spy = sinon.spy();
    portUtil.acquirePort(spy, {
      checkPorts: function (arr, cb) {
        cb([{
          port: arr[0],
          available: true
        }]);
      }
    });
    expect(spy.called).to.be.true;
  });

  it("should acquire a port after a retry", function () {
    var spy = sinon.spy();
    var attempt = 0;
    portUtil.acquirePort(spy, {
      checkPorts: function (arr, cb) {
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
