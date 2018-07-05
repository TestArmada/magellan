/* eslint no-undef: 0, no-unused-expressions: 0 */
'use strict';

const syncRequest = require('sync-request');
const hostedProfile = require('../src/hosted_profiles');

jest.mock('sync-request');

describe('hostedProfiles', () => {
  test('should return the #fragment from a URL', () => {
    expect(hostedProfile.getProfileNameFromURL('http://example.com/#boo')).toEqual('boo');
  });

  test('should return undefined for a URL wihtout fragments', () => {
    expect(hostedProfile.getProfileNameFromURL('http://example.com/')).toBeUndefined();
  });

  test('should return undefined for an invalid URL', () => {
    expect(hostedProfile.getProfileNameFromURL('👍')).toBeUndefined();
  });

  test('should hit URLs', () => {

    syncRequest.mockImplementation(() => {
      return {
        getBody: () => JSON.stringify({
          profiles: 'foo'
        })
      };
    });

    expect(hostedProfile.getProfilesAtURL('http://foozbaz.com')).toEqual({ profiles: 'foo' });
  });

  test('should check for malformed responses', () => {
    syncRequest.mockImplementation(() => {
      return {
        getBody: () => JSON.stringify({})
      };
    });

    try {
      hostedProfile.getProfilesAtURL('http://foozbaz.com');
    } catch (e) {
      expect(e.message).toEqual('Profiles supplied at http://foozbaz.com are malformed.');
    }
  });

  test('should check for malformed responses', () => {
    syncRequest.mockImplementation(() => {
      return {
        getBody: () => {
          return {};
        }
      };
    });

    try {
      hostedProfile.getProfilesAtURL('http://foozbaz.com');
    } catch (e) {
      expect(e.message).toEqual('Could not fetch profiles from http://foozbaz.com');
    }
  });
});
