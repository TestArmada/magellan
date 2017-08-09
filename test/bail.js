"use strict";

const chai = require("chai");
const chaiAsPromise = require("chai-as-promised");

const BailStrategy = require("../src/bail");

const BAIL_FAST = process.cwd() + "/src/strategies/bail_fast";
const BAIL_NEVER = process.cwd() + "/src/strategies/bail_never";
const BAIL_EARLY = process.cwd() + "/src/strategies/bail_early";


chai.use(chaiAsPromise);

const expect = chai.expect;
const assert = chai.assert;

describe("Bail Strategy", () => {
  let bailStrategy;

  beforeEach(() => {
    bailStrategy = new BailStrategy(BAIL_NEVER);
  });

  it("constructor throws error", () => {
    try {
      bailStrategy = new BailStrategy("FAKE_BAIL");
      assert(false, "shouldn't be here");
    } catch (e) {

    }
  });

  it("call configure on strategy doesn't have setConfiguration", () => {
    bailStrategy.configure({ early_bail_threshold: 1 });
  });

  it("call configure on strategy has setConfiguration", () => {
    bailStrategy = new BailStrategy(BAIL_EARLY);
    bailStrategy.configure({ early_bail_threshold: 1 });
  });

  it("call description with a strategy description", () => {
    bailStrategy = new BailStrategy(BAIL_EARLY);
    expect(bailStrategy.getDescription()).to.equal("Magellan will bail if failure ratio exceeds a threshold within a given period");
  });

  it("call description without a strategy description", () => {
    bailStrategy = new BailStrategy(BAIL_EARLY);
    delete bailStrategy.description;
    expect(bailStrategy.getDescription()).to.equal("");
  });

  it("call bailReason with a strategy bailReason", () => {
    bailStrategy = new BailStrategy(BAIL_FAST);
    expect(bailStrategy.getBailReason()).to.equal("At least one test has been failed");
  });

  it("call bailReason without a strategy bailReason", () => {
    bailStrategy = new BailStrategy(BAIL_FAST);
    delete bailStrategy.bailReason;
    expect(bailStrategy.getBailReason()).to.equal("");
  });

  it("call shouldBail if suite shouldn't bail", () => {
    bailStrategy = new BailStrategy(BAIL_NEVER);
    expect(bailStrategy.shouldBail()).to.equal(false);
  });

  it("call shouldBail if suite should bail", () => {
    bailStrategy = new BailStrategy(BAIL_NEVER);
    bailStrategy.decide = (info) => true;
    expect(bailStrategy.shouldBail()).to.equal(true);
  });
});