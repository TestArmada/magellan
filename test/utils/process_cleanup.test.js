/* eslint no-undef: 0, no-unused-expressions: 0, no-magic-numbers: 0 */
'use strict';

const treeKill = require('testarmada-tree-kill');
const processCleanup = require('../../src/util/process_cleanup')

jest.mock('testarmada-tree-kill');

test('cleanup no child process', () => {
  treeKill.getZombieChildren.mockImplementation((pid, maxtime, cb) => cb([]));
  
  return expect(processCleanup(null)).resolves.toBe(undefined);
});

test('cleanup 3 child processes', ()=>{
  treeKill.getZombieChildren.mockImplementation((pid, maxtime, cb) => cb([10, 20, 30]));
  treeKill.kill.mockImplementation((pid, sig, cb) => cb());

  return expect(processCleanup(null)).resolves.toBe(undefined);
});

test('cleanup no child process with error passing through', ()=>{
  treeKill.getZombieChildren.mockImplementation((pid, maxtime, cb) => cb([]));

  return expect(processCleanup('error')).rejects.toBe('error');
});

test('cleanup 3 child processes with error passing through', ()=>{
  treeKill.getZombieChildren.mockImplementation((pid, maxtime, cb) => cb([10, 20, 30]));
  treeKill.kill.mockImplementation((pid, sig, cb) => cb());

  return expect(processCleanup('error')).rejects.toBe('error');
});