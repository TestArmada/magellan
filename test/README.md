## How to run unit test
Magellan uses [jest](https://facebook.github.io/jest/en/) for unit test. To run unit test, please run 
1. `npm run test` for all tests
2. or `./node_modules/.bin/jest cli.test.js` for individual test file.

Magellan's unit test run also generates coverage report. Please check `coverage/lcov-report/index.html` for detail reports.

## How to add unit test for Magellan repo

1. Please name test file by `FILE.test.js` in test folder.
2. Please use mock as much as possible.
3. Please make sure test coverage is above the threshold before submitting to github.