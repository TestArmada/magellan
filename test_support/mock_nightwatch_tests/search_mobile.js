var Test = require("../lib/example-base-test-class");

module.exports = new Test({

  tags: ["search", "mobile"],

  "Test step one": function (client) {
    client
      .url("http://google.com/mobile");
  },

  "Test step two": function (client) {
    client
      .assert.elContainsText("body", "Google")
  }


});