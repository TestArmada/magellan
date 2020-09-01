'use strict';

const child_process = require('child_process');
const ChildProcess = require('../../src/util/childProcess');
const { PassThrough } = require('stream');

jest.mock('child_process');

const newHandler = () => ({
  removeAllListeners: () => { },
  stdout: new PassThrough(),
  stderr: {
    on: () => { },
    removeAllListeners: () => { },
    unpipe: () => { }
  },
  send: (msg) => { },
  on: (msg, cb) => cb(msg)
});

describe('Child process', () => {

  test('should construct new object', () => {
    const cp = new ChildProcess(newHandler());
  });

  test('should enable debug message', () => {
    const cp = new ChildProcess(newHandler());
    cp.enableDebugMsg();
  });

  test('should enable onMessage', (done) => {
    const cp = new ChildProcess(newHandler());

    cp.onMessage((msg) => {
      expect(msg).toEqual('message');
      done();
    });
  });

  test('should enable onClose', (done) => {
    const cp = new ChildProcess(newHandler());

    cp.onClose((msg) => {
      expect(msg).toEqual('close');
      done();
    });
  });

  test('should enable send', () => {
    const cp = new ChildProcess(newHandler());
    cp.send('fake message');
  });

  test('should emit message', () => {
    const cp = new ChildProcess(newHandler());
    cp.emitMessage('fake message');
  });

  test('should tearDown', () => {
    const cp = new ChildProcess(newHandler());
    cp.teardown();
  });

  test('should append data to stdout if contains whitelisted data', (done) => {
    const cp = new ChildProcess(newHandler());

    const warnTag = '\x1B[1;32m\x1B[40mWARN\x1B[0m'
    cp.handler.stdout.end(`${warnTag} sample data`);

    // wait for the write to flow thru the slicer and filter transforms
    setTimeout(() => {
      expect(cp.stdout).toContain(`${warnTag} sample data`);
      done();
    }, 0)

  });

  test('should add context to error message', (done) => {
    const cp = new ChildProcess(newHandler());

    const errorTag = '\x1B[1;33mERROR\x1B[0m';
    cp.handler.stdout.end(`${errorTag} Connection refused! Is selenium server started?`);

    // wait for the write to flow thru the slicer and filter transforms
    setTimeout(() => {
      expect(cp.stdout).toContain('Connection refused! Is selenium server started?')    
      expect(cp.stdout).toContain(`If running on saucelabs, perhaps you're out of capacity and should TRY RUN AGAIN LATER :)`);
      done();
    }, 0)

  })

  test('should exclude text that is not white listed', (done) => {
    const cp = new ChildProcess(newHandler());

    cp.handler.stdout.end('This text is not white listed');

    setTimeout(() => {
      expect(cp.stdout.trim().endsWith('Magellan child process start')).toEqual(true)
      done();
    }, 0)

  })

  test('should not exclude any text if env.debug is true', (done) => {
    process.env.DEBUG = true
    const cp = new ChildProcess(newHandler());

    cp.handler.stdout.end('This text is not white listed');

    setTimeout(() => {
      expect(cp.stdout.trim().endsWith('Magellan child process start')).toEqual(false)
      done();
    }, 0)

  })

});
