var expect = require('chai').expect;
var browsers = require('../../src/sauce/browsers');
var sinon = require("sinon");

describe('browsers', function() {
  before(function(done) {
    this.timeout(5000);
    browsers.initialize(false).then(function () {
      browsers.initialize(true).then(function () {
        done();
      });
    });
  });

  it('should listBrowsers', function() {
    var spy = sinon.spy();
    browsers.listBrowsers({log: spy});
    expect(spy.called).to.be.true;
  });

  it('should get a browser', function() {
    var b = browsers.browser("iphone_9_3_OS_X_10_11_iPhone_5");
    expect(b.browserName).to.eql("iphone");
  });

  it('should get no browser', function() {
    var b = browsers.browser("whatever");
    expect(b).to.not.exist;
  });

  it('should add from file', function() {
    try {
      browsers.addDevicesFromFile("foo");
    } catch(e) {
      expect(e).to.not.be.null;
    }
  });
});
