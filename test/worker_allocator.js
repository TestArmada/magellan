/* eslint no-undef: 0, no-magic-numbers: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const sinon = require("sinon");
const WorkerAllocator = require("../src/worker_allocator");

describe("WorkerAllocator", () => {
  it("should act like a class", () => {
    expect(new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      debug: true
    })).to.be.an.instanceof(WorkerAllocator);
  });

  it("should initialize", () => {
    const spy = sinon.spy();
    const worker = new WorkerAllocator(10, {
      console: {
        log: () => {}
      }
    });
    worker.initialize(spy);
    expect(spy.called).to.be.true;
  });

  it("should teardown", () => {
    const spy = sinon.spy();
    const worker = new WorkerAllocator(10, {
      console: {
        log: () => {}
      }
    });
    worker.teardown(spy);
    expect(spy.called).to.be.true;
  });

  it("should release", () => {
    const workers = new WorkerAllocator(10, {
      console: {
        log: () => {}
      }
    });
    workers.release(workers.workers[0]);
    expect(workers.workers[0].occupied).to.be.false;
  });

  it("should get", () => {
    const spy = sinon.spy();
    let port = 1;
    const workers = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      setTimeout: (cb) => {
        cb();
      },
      getNextPort: () => {
        port++;
        return port;
      },
      checkPorts: (ports, cb) => {
        const out = [];
        for (const p in ports) {
          out.push({
            port: ports[p],
            available: true
          });
        }
        cb(out);
      }
    });
    workers.get(spy);
    expect(spy.called).to.be.true;
  });

  it("should get and occupy everything", () => {
    const spy = sinon.spy();
    let port = 1;
    const workers = new WorkerAllocator(1, {
      console: {
        log: () => {}
      },
      setTimeout: (cb) => {
        cb();
      },
      getNextPort: () => {
        port++;
        return port;
      },
      checkPorts: (ports, cb) => {
        const out = [];
        for (const p in ports) {
          out.push({
            port: ports[p],
            available: true
          });
        }
        cb(out);
      }
    });
    workers.get(spy);
    expect(spy.called).to.be.true;
    workers.get(spy);
  });

  it("should get with nothing available", () => {
    const spy = sinon.spy();
    let port = 1;
    const workers = new WorkerAllocator(10, {
      console: {
        log: () => {}
      },
      setTimeout: (cb) => {
        cb();
      },
      getNextPort: () => {
        port++;
        return port;
      },
      checkPorts: (ports, cb) => {
        const out = [];
        for (const p in ports) {
          out.push({
            port: ports[p],
            available: false
          });
        }
        cb(out);
      }
    });
    workers.get(spy);
    expect(spy.called).to.be.true;
  });
});
