var expect = require('chai').expect;
var guid = require('../../src/util/guid');

describe('guid', function() {
  it('should create a guid', function() {
    expect(guid()).to.not.be.null;
  });
});
