"use strict";

module.exports = () => new Date().toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
