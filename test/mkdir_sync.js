var expect = require('chai').expect;
var mkdirSync = require('../src/mkdir_sync');
var sinon = require('sinon');

describe('mkdirSync', function() {
  it('should call mkdirSync', function() {
    var spy = sinon.spy();
    mkdirSync("foo", {
      fs: {
        mkdirSync: spy
      }
    });
    expect(spy.called).to.be.true;
  });

  it('should throw', function() {
    var ex = {code: "EEXIST"};
    try {
      mkdirSync("foo", {
        fs: {
          mkdirSync: () => {
            throw ex;
          }
        }
      });
    } catch(e) {
      expect(e).to.be.eql(ex);
    }
  });

  it('should throw with odd error', function() {
    var ex = {code: "FOO"};
    try {
      mkdirSync("foo", {
        fs: {
          mkdirSync: () => {
            throw ex;
          }
        }
      });
    } catch(e) {
      expect(e).to.be.eql(ex);
    }
  });
});
