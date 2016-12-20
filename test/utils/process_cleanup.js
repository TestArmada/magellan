/* eslint no-undef: 0, no-unused-expressions: 0, no-magic-numbers: 0 */
"use strict";
var expect = require("chai").expect;
var processCleanup = require("../../src/util/process_cleanup");
var sinon = require("sinon");

describe("process_cleanup", function () {
  it("cleanup no processes", function () {
    var spy = sinon.spy();
    processCleanup(spy, {
      console: {
        log: function () {}
      },
      treeUtil: {
        getZombieChildren: function (a1, a2, cb) {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb([]);
        }
      }
    });
  });

  it("cleanup no processes with debugging", function () {
    var spy = sinon.spy();
    processCleanup(spy, {
      console: {
        log: function () {}
      },
      settings: {
        debug: true
      },
      treeUtil: {
        getZombieChildren: function (a1, a2, cb) {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb([]);
        }
      }
    });
  });

  it("cleanup processes", function () {
    var spy = sinon.spy();
    processCleanup(spy, {
      console: {
        log: function () {}
      },
      treeUtil: {
        getZombieChildren: function (a1, a2, cb) {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb([10, 20, 30]);
        },
        kill: function (a1, a2, cb) {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb();
        }
      }
    });
  });

  it("cleanup processes with debug", function () {
    var spy = sinon.spy();
    processCleanup(spy, {
      console: {
        log: function () {}
      },
      settings: {
        debug: true
      },
      treeUtil: {
        getZombieChildren: function (a1, a2, cb) {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb([10, 20, 30]);
        },
        kill: function (a1, a2, cb) {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb();
        }
      }
    });
  });
});
