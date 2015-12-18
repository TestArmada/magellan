var chai = require("chai");
var expect = chai.expect;

// Note: must inject settings before we require get_tests
var settings = require("../src/settings");
settings.framework = "magellan-nightwatch";
settings.nightwatchConfigFilePath = "./test_support/mock_nightwatch_config.json";

var testFilter = require("../src/test_filter");
var getTests = require("../src/interop/magellan-nightwatch/get_tests");

var _ = require("lodash");

describe("nightwatch support", function () {

  describe("test iterator", function () {

    it("finds tests", function () {
      var tests = getTests();
      expect(tests).to.have.length(3);
    });

    it("finds tests with a tag filter", function () {
      var tests = getTests();
      var activeFilters = testFilter.detectFromCLI({"tags": "search"});
      var filteredTests = testFilter.filter(tests, activeFilters);

      expect(filteredTests).to.have.length(2);
    });

    it("finds fewer tests with a tag filter containing more matched tags", function () {
      var tests = getTests();
      var activeFilters = testFilter.detectFromCLI({"tags": "search,mobile"});
      var filteredTests = testFilter.filter(tests, activeFilters);

      expect(filteredTests).to.have.length(1);
    });

    it("finds no tests with an unmatched tag filter containing some matching tags", function () {
      var tests = getTests();
      var activeFilters = testFilter.detectFromCLI({"tags": "search,mobile,abc123"});
      var filteredTests = testFilter.filter(tests, activeFilters);

      expect(filteredTests).to.have.length(0);
    });

    it("finds no tests with an unmatched tag filter", function () {
      var tests = getTests();
      var activeFilters = testFilter.detectFromCLI({"tags": "abc123"});
      var filteredTests = testFilter.filter(tests, activeFilters);

      expect(filteredTests).to.have.length(0);
    });

  });

});