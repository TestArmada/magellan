var expect = require('chai').expect;
var Test = require('../src/test');

describe('Test Class', function() {

  it('should act like a class', function() {
    expect(new Test).to.be.an.instanceof(Test);
  });

  it('should use passed in locator', function() {
    var locator = {2: 'b'};
    var myTest = new Test(locator);
    expect(myTest.locator).to.equal(locator);
  });

  it('should use passed in browser', function() {
    var browser = "myBrowser";
    var myTest = new Test("", browser);
    expect(myTest.browser).to.equal(browser);
  });

  it('should use passed in Sauce Browser Settings', function() {
    var sauceBrowserSettings = {1: 'a'};
    var myTest = new Test("","",sauceBrowserSettings);
    expect(myTest.sauceBrowserSettings).to.equal(sauceBrowserSettings);
  });

  it('should use passed in max attempts', function() {
    var maxAttempts = {1: 'a'};
    var myTest = new Test("","","",maxAttempts);
    expect(myTest.maxAttempts).to.equal(maxAttempts);
  });

  it('should set canRun correctly for a passed test', function() {
    var myTest = new Test();
    myTest.pass();
    expect(myTest.canRun()).to.be.true;
  });

  it('should set canRun correctly for a failed test', function() {
    var myTest = new Test("","","",1);
    myTest.fail();
    myTest.fail();
    expect(myTest.canRun()).to.be.true;
  });

  it('should set canRun correctly for new test', function() {
    var myTest = new Test("","","",0);
    expect(myTest.canRun()).to.be.false;
  });

  it('should set test status correctly when new', function() {
    var myTest = new Test;
    expect(myTest.status).to.equal(1);
  });

  it('should set test status correctly when failed', function() {
    var myTest = new Test;
    myTest.fail();
    expect(myTest.status).to.equal(2);
  });

  it('should set test status correctly when failed', function() {
    var myTest = new Test;
    myTest.pass();
    expect(myTest.status).to.equal(3);
  });

  it('should start the clock with a Date', function() {
    var myTest = new Test;
    myTest.startClock();
    expect(myTest.runningTime).to.equal(undefined);
    expect(new Date(myTest.startTime)).to.be.an.instanceof(Date);
  });

  it('should stop the clock and set running time', function() {
    var myTest = new Test;
    myTest.startClock();
    myTest.stopClock();
    expect(new Date(myTest.runningTime)).to.be.an.instanceof(Date);
  });

  it('should compute retries', function() {
    var myTest = new Test;
    myTest.fail();
    myTest.pass();
    expect(myTest.getRetries()).to.equal(1);
  });
});
