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

});
