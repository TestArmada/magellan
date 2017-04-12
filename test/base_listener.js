/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
const BaseListener = require("../src/listener");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const expect = chai.expect;
chai.use(chaiAsPromised);

describe("listener", () => {
  it("should act like a class", () => {
    expect(new BaseListener()).to.be.an.instanceof(BaseListener);
  });

  it("should listenTo", () => {
    const myListener = new BaseListener();
    myListener.listenTo();
    expect(myListener.listenTo).to.not.be.null;
  });

  it("should flush", () => {
    const myListener = new BaseListener();
    myListener.flush().then(() => {});
    expect(myListener.flush).to.not.be.null;
  });

  it("should initialize", () => {
    const myListener = new BaseListener();
    return expect(myListener.initialize()).to.be.fulfilled;
  });
});
