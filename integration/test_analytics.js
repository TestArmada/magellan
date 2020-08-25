const chai = require("chai");
const expect = chai.expect;

const TestRunner = require("../src/test_runner");
const _ = require("lodash");
const settings = require("../src/settings");
const WorkerAllocator = require("../src/worker_allocator");
const TestAnalyticsListener = require("../test_support/test_analytics_listener");

settings.framework = "magellan-fake";
settings.testFramework = require("../test_support/magellan-selftest-plugin/index");
settings.testFramework.initialize({});

const MAX_WORKERS = 1;

const baseOptions = {
  debug: false,
  maxWorkers: MAX_WORKERS,
  maxTestAttempts: 1,
  browsers: ["phantomjs"],
  listeners: [],
  bailFast: false,
  bailOnThreshold: false,
  serial: false,

  allocator: undefined,
  sauceSettings: undefined
};

describe("analytics", () => {

  describe("events", function () {
    this.timeout(6000);

    let workerAllocator;
    let listener;
    let options;

    beforeEach((done) => {
      workerAllocator = new WorkerAllocator(MAX_WORKERS);
      listener = new TestAnalyticsListener();
      options = _.extend({}, baseOptions, {
        allocator: workerAllocator,
        listeners: [listener]
      });

      listener.initialize().then(() => {
        done();
      });
    });

    it("emits events @analytics", function (done) {
      this.timeout(6000);

      workerAllocator.initialize((err) => {
        const runner = new TestRunner(["fake_test1"], _.extend({}, options, {
          onSuccess () {
            // we should see at least fake test start and finish
            const testRunEvents = listener.timeline.filter((ev) => {
              return (ev.data && ev.data.name && _.startsWith(ev.data.name, "test-run-"))
                || (ev.eventName && _.startsWith(ev.eventName, "test-run-"));
            });
            expect(testRunEvents).to.have.length.of(2);
            done();
          }
        }));
        runner.start();
      });
    });

  });

});
