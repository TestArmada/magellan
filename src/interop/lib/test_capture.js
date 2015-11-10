/**
 * Recursive function, takes a mocha test suite and returns a flattened list of 
 * test found within
 */
function getTests(suite) {
	// TODO: filter pending/deactivated
	var tests = [];

	suite.tests.forEach(function(t) {
		tests.push({
			file: t.file,
			fullTitle: t.fullTitle(),
			pending: t.pending
		});
	});

	suite.suites.forEach(function(s) {
		tests = tests.concat(getTests(s));
	});

	return tests;
}

/**
 * Used as a mocha repoter for the test capturing phase
 */
module.exports = function(runner, options) {
	// capture but do not run tests
	runner.run = function(done) {
		done();
	}

	// traverse suite structure and flattened list of tests
	var tests = getTests(runner.suite);

	// process .only greps
	if (options.grep) {
		tests = tests.filter(function(t) {
			return t.fullTitle.match(options.grep);
		});
	}

	console.log(JSON.stringify(tests));
};
