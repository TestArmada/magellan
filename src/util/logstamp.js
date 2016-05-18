"use strict";

module.exports = function () {
  return new Date().toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
};
