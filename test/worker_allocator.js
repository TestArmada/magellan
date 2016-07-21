var expect = require('chai').expect;
var WorkerAllocator = require('../src/worker_allocator');


describe('WorkerAllocator', function() {

  it('should act like a class', function() {
    expect(new WorkerAllocator).to.be.an.instanceof(WorkerAllocator);
  });
});
