var Test = require("../lib/example-base-test-class");

module.exports = new Test({

  tags: ["wiki"],

  "Test step one": function (client) {
    client
      .url("http://en.wikipedia.org");
  },

  "Test step two": function (client) {
    client
      .assert.elContainsText("body", "Wikipedia")
  }


});