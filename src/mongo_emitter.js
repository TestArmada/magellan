/*
To enable MongoDB event export set the `MAGELLAN_MONGO_URL` environment variable to a URL
appropriate for client connect (e.g. `mongodb://localhost:27017/myproject`). As well as
`MAGELLAN_MONGO_COLLECTION` to the collection you'd like to add event documents to.
*/

"use strict";
var globalSettings = require("./settings");
var MongoClient = require("mongodb").MongoClient;
var Q = require("q");

var _mongoConfig = {
  enabled: process.env.MAGELLAN_MONGO_URL !== null && process.env.MAGELLAN_MONGO_DB  !== null,
  url: process.env.MAGELLAN_MONGO_URL,
  collection: process.env.MAGELLAN_MONGO_COLLECTION,
  mockCollection: null
};

var _dbPromise = null;
var _getDB = function () {
  if (_dbPromise === null) {
    var def = Q.defer();
    MongoClient.connect(_mongoConfig.url, function (err, database) {
      if (err) {
        def.reject(err);
      }
      else {
        def.resolve(database);
      }
    });
    return _dbPromise = def.promise;
  } else {
    return _dbPromise;
  }
};

var _mongoCollection = null;
var _insert = function (message) {
  if (_mongoConfig.mockCollection) {
    _mongoConfig.mockCollection.insertOne(message);
  } else if (_mongoConfig.enabled) {
    _getDB().then(function (db) {
      db.collection(_mongoConfig.collection).insertOne(message);
    });
  }
  return null;
};

module.exports = {
  setup: function() {
  },
  shutdown: function () {
    if (_mongoConfig.enabled) {
      _getDB().then(function (db) {
        console.log("Closing mongo connection");
        db.close();
      });
    }
  },
  testRunMessage: function (testRun, test, message) {
    _insert({
      type: "testRun",
      testRun: testRun,
      test: test,
      message: message,
      jobName: globalSettings.jobName,
      buildDisplayName: globalSettings.buildDisplayName,
      buildURL: globalSettings.buildURL
    });
  },
  globalMessage: function (message) {
    _insert({
      type: "global",
      message: message,
      jobName: globalSettings.jobName,
      buildDisplayName: globalSettings.buildDisplayName,
      buildURL: globalSettings.buildURL
    });
  },
  setMock: function (mockCollection) {
    _mongoConfig.mockCollection = mockCollection;
  }
};
