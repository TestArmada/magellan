/* eslint no-undef: 0, no-magic-numbers: 0, max-nested-callbacks: 0, no-unused-expressions: 0,
  no-invalid-this: 0 */
"use strict";
const expect = require("chai").expect;
const browsers = require("../../src/sauce/browsers");
const sinon = require("sinon");

describe("browsers", () => {
  before(function (done) {
    this.timeout(10000);
    browsers.initialize(false).then(() => {
      browsers.initialize(true).then(() => {
        done();
      });
    });
  });

  it("should listBrowsers", () => {
    const spy = sinon.spy();
    browsers.listBrowsers({
      console: {log: spy},
      listSauceCliBrowsers: (cb) => {
        cb({options: {head: {}}});
      }
    });
    expect(spy.called).to.be.true;
  });

  it("should get a browser", () => {
    const b = browsers.browser("chrome_55_Windows_10_Desktop");
    expect(b.browserName).to.eql("chrome");
  });

  it("should get no browser", () => {
    const b = browsers.browser("whatever");
    expect(b).to.not.exist;
  });

  it("should add from file", () => {
    try {
      browsers.addDevicesFromFile("foo");
    } catch (e) {
      expect(e).to.not.be.null;
    }
  });
});
