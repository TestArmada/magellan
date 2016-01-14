Test Framework Plugin Structure
===============================

Test frameworks in Magellan are supported with plugins.

A plugin is just a node module that exports the following signature:

```javascript

{
	initialize: function (argv) {
		// argv: command line arguments and stored configuration loaded by magellan
	},

	// Return an array of tests
	iterator: function () {

	},

	// constructor for TestRun class
	TestRun: function () { }

	// Implementations for
	// optional?
	filters: {
		// Provide support for arg: --tags=t1,t2,t3
		// Return an array of files that match list of tags
		tags: function (files, tags) { }

		// Provide support for arg: --group=test/subfolder
		// Return a list of files that match a group prefix,
		group: function (files, group) { }

		// Provide support for arg: --test=specific/test.js
		test:  function (files, specificPath) { }
	}
}

