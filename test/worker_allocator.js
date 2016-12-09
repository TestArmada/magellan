var expect = require('chai').expect;
var sinon = require("sinon");
var WorkerAllocator = require('../src/worker_allocator');

describe('WorkerAllocator', function() {
  it('should act like a class', function() {
    expect(new WorkerAllocator(10, {
      console: {
        log: function() {},
      },
      debug: true
    })).to.be.an.instanceof(WorkerAllocator);
  });

  it('should initialize', function() {
    var spy = sinon.spy();
    var worker = new WorkerAllocator(10, {
      console: {
        log: function() {}
      }
    });
    worker.initialize(spy);
    expect(spy.called).to.be.true;
  });

  it('should teardown', function() {
    var spy = sinon.spy();
    var worker = new WorkerAllocator(10, {
      console: {
        log: function() {}
      }
    });
    worker.teardown(spy);
    expect(spy.called).to.be.true;
  });

  it('should release', function() {
    var workers = new WorkerAllocator(10, {
      console: {
        log: function() {}
      }
    });
    workers.release(workers.workers[0]);
    expect(workers.workers[0].occupied).to.be.false;
  });

  it('should get', function() {
    var spy = sinon.spy();
    var port = 1;
    var workers = new WorkerAllocator(10, {
      console: {
        log: function() {}
      },
      setTimeout: function(cb) {
        cb();
      },
      getNextPort: function() {
        port++;
        return port;
      },
      checkPorts: function(ports, cb) {
        var out = [];
        for (var p in ports) {
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

  it('should get and occupy everything', function() {
    var spy = sinon.spy();
    var port = 1;
    var workers = new WorkerAllocator(1, {
      console: {
        log: function() {}
      },
      setTimeout: function(cb) {
        cb();
      },
      getNextPort: function() {
        port++;
        return port;
      },
      checkPorts: function(ports, cb) {
        var out = [];
        for (var p in ports) {
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

  it('should get with nothing available', function() {
    var spy = sinon.spy();
    var port = 1;
    var workers = new WorkerAllocator(10, {
      console: {
        log: function() {}
      },
      setTimeout: function(cb) {
        cb();
      },
      getNextPort: function() {
        port++;
        return port;
      },
      checkPorts: function(ports, cb) {
        var out = [];
        for (var p in ports) {
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
