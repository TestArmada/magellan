/* eslint no-undef: 0, no-empty: 0, no-unused-expressions: 0 */
"use strict";
var expect = require("chai").expect;
var MongoEmitter = require("../src/mongo_emitter");
var sinon = require("sinon");

describe("MongoEmitter", function () {
  afterEach(function () {
    MongoEmitter.setMock(null);
  });

  it("should shutdown", function () {
    var spy = sinon.spy();
    MongoEmitter.setMock("mongo://foo", {
      connect: function (url, cb) {
        expect(url).to.eql("mongo://foo");
        cb(null, {
          close: spy
        });
      }
    }, {
      log: function () {}
    });
    MongoEmitter.shutdown(function () {
      expect(spy.called).to.be.true;
    });
  });

  it("should throw on a bad connection", function () {
    try {
      MongoEmitter.setMock("mongo://foo", {
        connect: function (url, cb) {
          expect(url).to.eql("mongo://foo");
          cb(new Error("foo"), {});
        }
      });
      MongoEmitter.globalMessage({});
    } catch (e) {
    }
  });

  it("should send test run messages", function () {
    MongoEmitter.setMock("mongo://foo", {
      connect: function (url, cb) {
        expect(url).to.eql("mongo://foo");
        cb(null, {
          collection: function () {
            return {
              insertOne: function (data) {
                expect(data.testRun).to.eql("testRun");
                expect(data.test).to.eql("test");
                expect(data.message).to.eql("message");
              }
            };
          }
        });
      },
      done: function () {}
    });
    MongoEmitter.testRunMessage("testRun", "test", "message");
    MongoEmitter.testRunMessage("testRun", "test", "message");
  });

  it("should send global messages", function () {
    MongoEmitter.setMock("mongo://foo", {
      connect: function (url, cb) {
        expect(url).to.eql("mongo://foo");
        cb(null, {
          collection: function () {
            return {
              insertOne: function (data) {
                expect(data.message).to.eql("message");
              }
            };
          }
        });
      },
      done: function () {}
    });
    MongoEmitter.globalMessage("message");
  });

  it("should finish", function () {
    MongoEmitter.setMock("mongo://foo", {
      connect: function (url, cb) {
        expect(url).to.eql("mongo://foo");
        cb(null, {});
      },
      close: function () {
      }
    }, {
      log: function () {}
    });
    MongoEmitter.setup();
    MongoEmitter.shutdown();
  });
});
