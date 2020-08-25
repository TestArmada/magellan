/* eslint no-undef: 0, no-magic-numbers: 0, no-unused-expressions: 0 */
'use strict';

const Test = require('../src/test');

describe('Test Class', () => {

  test('should act like a class', () => {
    expect(new Test()).toBeInstanceOf(Test);
  });

  test('should use passed in locator', () => {
    const locator = { 2: 'b' };
    const myTest = new Test(locator);
    expect(myTest.locator).toEqual(locator);
  });

  test('should get runtime', () => {
    const browser = 'myBrowser';
    const myTest = new Test('', browser);
    myTest.runningTime = 50;
    expect(myTest.getRuntime()).toEqual(50);
  });

  test('should convert to a string', () => {
    const browser = 'myBrowser';
    const myTest = new Test('', browser);
    myTest.getRuntime();
    expect(myTest.toString()).toEqual(' @myBrowser');
  });

  test('should use passed in browser', () => {
    const browser = 'myBrowser';
    const myTest = new Test('', browser);
    myTest.toString();
    myTest.getRuntime();
    expect(myTest.browser).toBeUndefined();
  });

  test('should use passed in Sauce Browser Settings', () => {
    const sauceBrowserSettings = { 1: 'a' };
    const myTest = new Test('', '', sauceBrowserSettings);
    expect(myTest.sauceBrowserSettings).toBeUndefined();
  });

  test('should use passed in max attempts', () => {
    const maxAttempts = { 1: 'a' };
    const myTest = new Test('', '', '', maxAttempts);
    expect(myTest.maxAttempts).toEqual(maxAttempts);
  });

  test('should set canRun correctly for a passed test', () => {
    const myTest = new Test();
    myTest.pass();
    expect(myTest.canRun()).toBeTruthy();
  });

  test('should set canRun correctly for a failed test', () => {
    const myTest = new Test('', '', '', 1);
    myTest.fail();
    myTest.fail();
    expect(myTest.canRun()).toBeTruthy();
  });

  test('should set canRun correctly for new test', () => {
    const myTest = new Test('', '', '', 0);
    expect(myTest.canRun()).not.toBeTruthy();
  });

  test('should set test status correctly when new', () => {
    const myTest = new Test();
    expect(myTest.status).toEqual(1);
  });

  test('should set test status correctly when failed', () => {
    const myTest = new Test();
    myTest.fail();
    expect(myTest.status).toEqual(2);
  });

  test('should set test status correctly when failed', () => {
    const myTest = new Test();
    myTest.pass();
    expect(myTest.status).toEqual(3);
  });

  test('should start the clock with a Date', () => {
    const myTest = new Test();
    myTest.startClock();
    expect(myTest.runningTime).toBeUndefined();
    expect(new Date(myTest.startTime)).toBeInstanceOf(Date);
  });

  test('should stop the clock and set running time', () => {
    const myTest = new Test();
    myTest.startClock();
    myTest.stopClock();
    expect(new Date(myTest.runningTime)).toBeInstanceOf(Date);
  });

  test('should compute retries', () => {
    const myTest = new Test();
    myTest.fail(1);
    myTest.pass();
    expect(myTest.getRetries()).toEqual(1);
  });
});
