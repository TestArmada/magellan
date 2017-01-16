/* eslint no-undef: 0, no-unused-expressions: 0, no-magic-numbers: 0 */
"use strict";
const expect = require("chai").expect;
const processCleanup = require("../../src/util/process_cleanup");
const sinon = require("sinon");

describe("process_cleanup", () => {
  it("cleanup no processes", () => {
    const spy = sinon.spy();
    processCleanup(spy, {
      console: {
        log: () => {}
      },
      treeUtil: {
        getZombieChildren: (a1, a2, cb) => {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb([]);
        }
      }
    });
  });

  it("cleanup no processes with debugging", () => {
    const spy = sinon.spy();
    processCleanup(spy, {
      console: {
        log: () => {}
      },
      settings: {
        debug: true
      },
      treeUtil: {
        getZombieChildren: (a1, a2, cb) => {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb([]);
        }
      }
    });
  });

  it("cleanup processes", () => {
    const spy = sinon.spy();
    processCleanup(spy, {
      console: {
        log: () => {}
      },
      treeUtil: {
        getZombieChildren: (a1, a2, cb) => {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb([10, 20, 30]);
        },
        kill: (a1, a2, cb) => {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb();
        }
      }
    });
  });

  it("cleanup processes with debug", () => {
    const spy = sinon.spy();
    processCleanup(spy, {
      console: {
        log: () => {}
      },
      settings: {
        debug: true
      },
      treeUtil: {
        getZombieChildren: (a1, a2, cb) => {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb([10, 20, 30]);
        },
        kill: (a1, a2, cb) => {
          expect(a1).to.not.be.null;
          expect(a2).to.not.be.null;
          cb();
        }
      }
    });
  });
});
