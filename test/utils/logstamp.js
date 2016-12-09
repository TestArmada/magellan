var expect = require('chai').expect;
var logstamp = require('../../src/util/logstamp');

describe('logstamp', function() {
  it('should create a logstamp', function() {
    expect(logstamp()).to.not.be.null;
  });
});
