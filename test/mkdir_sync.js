/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const mkdirSync = require("../src/mkdir_sync");
const sinon = require("sinon");

describe("mkdirSync", () => {
  it("should call mkdirSync", () => {
    const spy = sinon.spy();
    mkdirSync("foo", {
      fs: {
        mkdirSync: spy
      }
    });
    expect(spy.called).to.be.true;
  });

  it("should throw", () => {
    const ex = {code: "EEXIST"};
    try {
      mkdirSync("foo", {
        fs: {
          mkdirSync: () => {
            throw ex;
          }
        }
      });
    } catch (e) {
      expect(e).to.be.eql(ex);
    }
  });

  it("should throw with odd error", () => {
    const ex = {code: "FOO"};
    try {
      mkdirSync("foo", {
        fs: {
          mkdirSync: () => {
            throw ex;
          }
        }
      });
    } catch (e) {
      expect(e).to.be.eql(ex);
    }
  });
});
