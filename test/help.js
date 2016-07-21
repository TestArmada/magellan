var expect = require('chai').expect;
var cli_help = require('../src/cli_help');


describe('cli_help', function() {
  it('should return default help', function() {
    expect(cli_help.help).to.exist;
  });
});
