var expect = require('chai').expect;
var Reporter = require('../../src/reporters/reporter');

describe('Reporter', function() {
  it('should be a listener', function() {
    var r = new Reporter();
    expect(r.initialize).to.not.be.null;
    expect(r.listenTo).to.not.be.null;
    expect(r.flush).to.not.be.null;
  });
});
