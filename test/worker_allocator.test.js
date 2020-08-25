/* eslint no-undef: 0, no-magic-numbers: 0, no-unused-expressions: 0 */
"use strict";

const settings = require("../src/settings");
const WorkerAllocator = require("../src/worker_allocator");

jest.mock("../src/settings", () => {
  return {
    BASE_PORT_START: 12000,
    BASE_PORT_RANGE: 2000,
    BASE_PORT_SPACING: 3,
    MAX_WORKERS: 3,
    MAX_ALLOCATION_ATTEMPTS: 2,
    WORKER_START_DELAY: 100
  };
});

describe("WorkerAllocator", () => {
  test("should construct", () => {
    const w = new WorkerAllocator(10);
    expect(w.workers).toHaveLength(10);
  });

  test("should set up", () => {
    const w = new WorkerAllocator(10);
    expect(w.setup()).resolves.toBeUndefined();
  });

  test("should tear down without error", () => {
    const w = new WorkerAllocator(10);
    expect(w.teardown()).resolves.toBeUndefined();
  });

  test("should tear down with error", () => {
    const w = new WorkerAllocator(10);
    expect(w.teardown("err")).rejects.toEqual("err");
  });

  test("should release worker", () => {
    const w = new WorkerAllocator(10);
    const worker = { occupied: true };
    w.release(worker);

    expect(worker.occupied).toEqual(false);
  });

  test("should get worker when at least one is available", (done) => {
    const w = new WorkerAllocator(10);

    w.get((err, worker) => {
      expect(worker.occupied).toEqual(true);
      done();
    });
  });

  test("shouldn throw error if no worker is available", (done) => {
    const w = new WorkerAllocator(1);
    w.workers = [{ index: 1, occupied: true, portOffset: 12000 }];

    w.get((err, worker) => {
      expect(err).toEqual("Couldn't allocate a worker after 2 attempts");
      done();
    });
  });

  test("shouldn skip current port if occupied already", (done) => {
    const portUtil = require("../src/util/port_util");
    jest.mock("../src/util/port_util");

    portUtil.getNextPort.mockImplementation(() => 12000);

    portUtil.checkPorts.mockImplementation((ports, cb) => {
      if (_.includes(ports, 12003)) {
        cb([
          { port: 12003, available: true },
          { port: 12004, available: false },
          { port: 12005, available: true }
        ]);
      } else {
        cb([
          { port: 12006, available: true },
          { port: 12007, available: true },
          { port: 12008, available: true }
        ]);
      }
    });

    const w = new WorkerAllocator(1);
    w.name = "lei";
    w.get((err, worker) => {
      console.log(worker);
      done();
    });
  });
});
