"use strict";

var RAND_MAX = 9999999999999999;
var STRNUM_BASE = 16;

module.exports = function () {
  return Math.round(Math.random() * RAND_MAX).toString(STRNUM_BASE);
};
