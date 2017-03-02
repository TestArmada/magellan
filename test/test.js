/* eslint no-undef: 0, no-magic-numbers: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const Test = require("../src/test");

describe("Test Class", () => {

  it("should act like a class", () => {
    expect(new Test()).to.be.an.instanceof(Test);
  });

  it("should use passed in locator", () => {
    const locator = {2: "b"};
    const myTest = new Test(locator);
    expect(myTest.locator).to.equal(locator);
  });

  it("should get runtime", () => {
    const browser = "myBrowser";
    const myTest = new Test("", browser);
    myTest.runningTime = 50;
    expect(myTest.getRuntime()).to.eql(50);
  });

  it("should convert to a string", () => {
    const browser = "myBrowser";
    const myTest = new Test("", browser);
    myTest.getRuntime();
    expect(myTest.toString()).to.equal(" @myBrowser");
  });

  it("should use passed in browser", () => {
    const browser = "myBrowser";
    const myTest = new Test("", browser);
    myTest.toString();
    myTest.getRuntime();
    expect(myTest.browser).to.equal(undefined);
  });

  it("should use passed in Sauce Browser Settings", () => {
    const sauceBrowserSettings = {1: "a"};
    const myTest = new Test("", "", sauceBrowserSettings);
    expect(myTest.sauceBrowserSettings).to.equal(undefined);
  });

  it("should use passed in max attempts", () => {
    const maxAttempts = {1: "a"};
    const myTest = new Test("", "", "", maxAttempts);
    expect(myTest.maxAttempts).to.equal(maxAttempts);
  });

  it("should set canRun correctly for a passed test", () => {
    const myTest = new Test();
    myTest.pass();
    expect(myTest.canRun()).to.be.true;
  });

  it("should set canRun correctly for a failed test", () => {
    const myTest = new Test("", "", "", 1);
    myTest.fail();
    myTest.fail();
    expect(myTest.canRun()).to.be.true;
  });

  it("should set canRun correctly for new test", () => {
    const myTest = new Test("", "", "", 0);
    expect(myTest.canRun()).to.be.false;
  });

  it("should set test status correctly when new", () => {
    const myTest = new Test();
    expect(myTest.status).to.equal(1);
  });

  it("should set test status correctly when failed", () => {
    const myTest = new Test();
    myTest.fail();
    expect(myTest.status).to.equal(2);
  });

  it("should set test status correctly when failed", () => {
    const myTest = new Test();
    myTest.pass();
    expect(myTest.status).to.equal(3);
  });

  it("should start the clock with a Date", () => {
    const myTest = new Test();
    myTest.startClock();
    expect(myTest.runningTime).to.equal(undefined);
    expect(new Date(myTest.startTime)).to.be.an.instanceof(Date);
  });

  it("should stop the clock and set running time", () => {
    const myTest = new Test();
    myTest.startClock();
    myTest.stopClock();
    expect(new Date(myTest.runningTime)).to.be.an.instanceof(Date);
  });

  it("should compute retries", () => {
    const myTest = new Test();
    myTest.fail();
    myTest.pass();
    expect(myTest.getRetries()).to.equal(1);
  });
});
