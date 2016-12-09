var expect = require('chai').expect;
var cli_help = require('../src/cli_help');

describe('cli_help', function() {
  it('should return default help', function() {
    cli_help.help({
      console: {
        log: () => {}
      },
      settings: {
        testFramework: {
          help: {
            foobar: {
              example: "baz",
              description: "d"
            }
          }
        }
      }
    });
    expect(cli_help.help).to.exist;
  });

  it('should return default help without example', function() {
    cli_help.help({
      console: {
        log: () => {}
      },
      settings: {
        testFramework: {
          help: {
            foobar: {
              description: "d"
            }
          }
        }
      }
    });
    expect(cli_help.help).to.exist;
  });

  it('should return default help with no help key', function() {
    cli_help.help({
      console: {
        log: () => {}
      },
      settings: {
        testFramework: {
        }
      }
    });
    expect(cli_help.help).to.exist;
  });

  it('should return default help with no help keys', function() {
    cli_help.help({
      console: {
        log: () => {}
      },
      settings: {
      }
    });
    expect(cli_help.help).to.exist;
  });
});
