var expect = require('chai').expect;
var getTests = require('../src/get_tests');

describe('getTests', function() {
  it('should get tests', function() {
    expect(getTests({
      a: function() { return true; },
      b: function() { return true; }
    }, {
      settings: {
        testFramework: {
          iterator: function () {
            return ["a", "b", "c"];
          },
          filters: {
            a: function() { return true; },
            b: function() { return true; }
          }
        }
      }
    })).to.eql(true);
  });
});
