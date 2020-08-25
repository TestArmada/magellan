'use strict';

const child_process = require('child_process');
const ChildProcess = require('../../src/util/childProcess');

jest.mock('child_process');

const handler = {
  removeAllListeners: () => { },
  stdout: {
    on: () => { },
    removeAllListeners: () => { },
    unpipe: () => { }
  },
  stderr: {
    on: () => { },
    removeAllListeners: () => { },
    unpipe: () => { }
  },
  send: (msg) => { },
  on: (msg, cb) => cb(msg)
};

describe('Child process', () => {

  test('should construct new object', () => {
    const cp = new ChildProcess(handler);
  });

  test('should enable debug message', () => {
    const cp = new ChildProcess(handler);
    cp.enableDebugMsg();
  });

  test('should enable onMessage', (done) => {
    const cp = new ChildProcess(handler);

    cp.onMessage((msg) => {
      expect(msg).toEqual('message');
      done();
    });
  });

  test('should enable onClose', (done) => {
    const cp = new ChildProcess(handler);

    cp.onClose((msg) => {
      expect(msg).toEqual('close');
      done();
    });
  });

  test('should enable send', () => {
    const cp = new ChildProcess(handler);
    cp.send('fake message');
  });

  test('should emit message', () => {
    const cp = new ChildProcess(handler);
    cp.emitMessage('fake message');
  });

  test('should tearDown', () => {
    const cp = new ChildProcess(handler);
    cp.teardown();
  });

  test('should append data to stdout', () => {
    const cp = new ChildProcess(handler);

    cp.onDataCallback('fake data');
    cp.onDataCallback('real data');
    cp.onDataCallback('');

    expect(cp.stdout).toContain('fake data');
    expect(cp.stdout).toContain('real data');
  });

  test('should add context to error message', () => {
    const cp = new ChildProcess(handler);

    cp.onDataCallback('Connection refused! Is selenium server started?')

    expect(cp.stdout).toContain('Connection refused! Is selenium server started?')    
    expect(cp.stdout).toContain(`If running on saucelabs, perhaps you're out of capacity and should TRY RUN AGAIN LATER :)`);
  })
});
