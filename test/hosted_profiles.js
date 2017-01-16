/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
const expect = require("chai").expect;
const hostedProfile = require("../src/hosted_profiles");

describe("hostedProfiles", () => {
  it("should return the #fragment from a URL", () => {
    expect(hostedProfile.getProfileNameFromURL("http://example.com/#boo")).to.eql("boo");
  });

  it("should return undefined for a URL wihtout fragments", () => {
    expect(hostedProfile.getProfileNameFromURL("http://example.com/")).to.be.undefined;
  });

  it("should return undefined for an invalid URL", () => {
    expect(hostedProfile.getProfileNameFromURL("👍")).to.be.undefined;
  });

  it("should hit URLs", () => {
    expect(hostedProfile.getProfilesAtURL("http://foozbaz.com", {
      syncRequest: () => {
        return {
          getBody: () => {
            return JSON.stringify({
              profiles: "foo"
            });
          }
        };
      }
    })).to.eql({profiles: "foo"});
  });

  it("should check for malformed responses", () => {
    try {
      hostedProfile.getProfilesAtURL("http://foozbaz.com", {
        syncRequest: () => {
          return {
            getBody: () => {
              return JSON.stringify({});
            }
          };
        }
      });
    } catch (e) {
      expect(e.message).to.eql("Profiles supplied at http://foozbaz.com are malformed.");
    }
  });

  it("should check for malformed responses", () => {
    try {
      hostedProfile.getProfilesAtURL("http://foozbaz.com", {
        syncRequest: () => {
          return {
            getBody: () => {
              return {};
            }
          };
        }
      });
    } catch (e) {
      expect(e.message).to.eql("Could not fetch profiles from http://foozbaz.com");
    }
  });
});
