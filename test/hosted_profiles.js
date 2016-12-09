var expect = require('chai').expect;
var hosted_profile = require('../src/hosted_profiles');


describe('hosted_profiles', function() {
  it('should return the #fragment from a URL', function() {
    expect(hosted_profile.getProfileNameFromURL('http://example.com/#boo')).to.eql('boo');
  });

  it('should return undefined for a URL wihtout fragments', function() {
    expect(hosted_profile.getProfileNameFromURL('http://example.com/')).to.be.undefined;
  });

  it('should return undefined for an invalid URL', function() {
    expect(hosted_profile.getProfileNameFromURL("👍'")).to.be.undefined;
  });

  it('should hit URLs', function() {
    expect(hosted_profile.getProfilesAtURL("http://foozbaz.com", {
      syncRequest: function () {
        return {
          getBody: () => {
            return JSON.stringify({
              profiles: "foo"
            });
          }
        }
      }
    })).to.eql({profiles: "foo"});
  });

  it('should check for malformed responses', function() {
    try {
      hosted_profile.getProfilesAtURL("http://foozbaz.com", {
        syncRequest: function () {
          return {
            getBody: () => {
              return JSON.stringify({});
            }
          }
        }
      })
    } catch(e) {
      expect(e.message).to.eql("Profiles supplied at http://foozbaz.com are malformed.");
    }
  });

  it('should check for malformed responses', function() {
    try {
      hosted_profile.getProfilesAtURL("http://foozbaz.com", {
        syncRequest: function () {
          return {
            getBody: () => {
              return {};
            }
          }
        }
      })
    } catch(e) {
      expect(e.message).to.eql("Could not fetch profiles from http://foozbaz.com");
    }
  });
});
