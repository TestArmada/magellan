var _ = require("lodash");
var EventEmitter = require("events");

module.exports = {

  emitter: new EventEmitter(),

  //
  //
  //
  // TODO: add local timeline buffer so we are able to sync up
  // listeners that arrive late
  //
  //
  //

  // note: name must be unique if non-colliding markers are desired
  push: function (eventName, metadata) {
    this.emitter.emit("message", {
      type: "analytics-event",
      data: {
        name: eventName,

        markers: [{
          name: "start",
          t: Date.now()
        }],

        metadata: metadata
      }
    });
  },

  mark: function (eventName, markerName) {
    markerName = markerName ? markerName : "end";

    this.emitter.emit("message", {
      type: "analytics-event-mark",
      eventName: eventName,
      data: {
        name: markerName,
        t: Date.now()
      }
    });

  }
};