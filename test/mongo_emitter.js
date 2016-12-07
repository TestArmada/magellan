var expect = require('chai').expect;
var MongoEmitter = require('../src/mongo_emitter');

describe('MongoEmitter', function() {
  afterEach(function() {
    MongoEmitter.setMock(null);
  });

  it('should send test run messages', function() {
    MongoEmitter.setMock({
      insertOne: function(data) {
        expect(data.testRun).to.eql("testRun");
        expect(data.test).to.eql("test");
        expect(data.message).to.eql("message");
      }
    });
    MongoEmitter.testRunMessage("testRun", "test", "message");
  });

  it('should send global messages', function() {
    MongoEmitter.setMock({
      insertOne: function(data) {
        expect(data.message).to.eql("message");
      }
    });
    MongoEmitter.globalMessage("message");
  });
});
