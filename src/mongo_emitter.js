/* eslint callback-return: 0, no-extra-parens: 0 */
/*
To enable MongoDB event export set the `MAGELLAN_MONGO_URL` environment variable to a URL
appropriate for client connect (e.g. `mongodb://localhost:27017/myproject`). As well as
`MAGELLAN_MONGO_COLLECTION` to the collection you'd like to add event documents to.
*/

"use strict";
var globalSettings = require("./settings");
var MongoClient = require("mongodb").MongoClient;
var Q = require("q");
var EventEmitter = require("events").EventEmitter;

var _evtEmitter = new EventEmitter();

var _mongoConfig = {
  enabled: process.env.MAGELLAN_MONGO_URL && process.env.MAGELLAN_MONGO_COLLECTION,
  url: process.env.MAGELLAN_MONGO_URL,
  collection: process.env.MAGELLAN_MONGO_COLLECTION,
  mockDB: null,
  mockConsole: null
};

var _console = function (x) {
  var _c = console;
  /* istanbul ignore next */
  if (_mongoConfig.mockConsole) {
    _c = _mongoConfig.mockConsole;
  }
  _c.log(x);
};

var _dbPromise = null;
var _getDB = function () {
  var _mc = MongoClient;
  /* istanbul ignore next */
  if (_mongoConfig.mockDB) {
    _mc = _mongoConfig.mockDB;
  }
  if (_dbPromise === null) {
    var def = Q.defer();
    var t = new Date();
    _mc.connect(_mongoConfig.url, function (err, database) {
      if (err) {
        _evtEmitter.emit("connectFailure");
        /* istanbul ignore next */
        def.reject(err);
      } else {
        _evtEmitter.emit("connect", (new Date()) - t);
        def.resolve(database);
      }
    });
    _dbPromise = def.promise;
  }
  return _dbPromise;
};

var _insert = function (message, cb) {
  if (_mongoConfig.enabled) {
    var t = new Date();
    _getDB().then(function (db) {
      db.collection(_mongoConfig.collection).insertOne(message);
      var dt = (new Date()) - t;
      _evtEmitter.emit("insert", dt);
      if (cb) {
        cb();
      }
    });
  }
  return null;
};

module.exports = {
  events: _evtEmitter,
  setup: function () {
  },
  shutdown: function (cb) {
    if (_mongoConfig.enabled) {
      _getDB().then(function (db) {
        _console("Closing mongo connection");
        db.close();
        if (cb) {
          cb();
        }
      });
    }
  },
  testRunMessage: function (testRun, test, message, cb) {
    _insert({
      type: "testRun",
      testRun: testRun,
      test: test,
      message: message,
      jobName: globalSettings.jobName,
      buildDisplayName: globalSettings.buildDisplayName,
      buildURL: globalSettings.buildURL
    }, cb);
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
  setMock: function (mockURL, mockDB, mockConsole) {
    _mongoConfig.url = mockURL;
    _mongoConfig.mockDB = mockDB;
    _mongoConfig.mockConsole = mockConsole;
    _mongoConfig.enabled = mockDB;
    _dbPromise = null;
  }
};
