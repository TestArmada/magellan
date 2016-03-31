"use strict";

var _ = require("lodash");
var EventEmitter = require("events").EventEmitter;
var timeline = [];

module.exports = {

  _emitter: new EventEmitter(),

  // Push a global (i.e. not testrun related) analytics event to the timeline.
  // This will cause any reporters that listen to global analytics events to
  // receive the event. A markers list will be started with the current time.
  //
  // NOTE: name must be unique if non-colliding markers are desired.
  push: function (eventName, metadata, startMarkerName) {
    startMarkerName = startMarkerName ? startMarkerName : "start";

    var ev = {
      type: "analytics-event",
      data: {
        name: eventName,

        markers: [{
          name: startMarkerName,
          t: Date.now()
        }],

        metadata: metadata
      }
    };

    this._emitter.emit("message", ev);
    timeline.push(ev);
  },

  // Mark an event's timeline with a marker named markerName at current time.
  // Default to a marker name of "end" if one isn't supplied.
  mark: function (eventName, markerName) {
    markerName = markerName ? markerName : "end";

    var ev = {
      type: "analytics-event-mark",
      eventName: eventName,
      data: {
        name: markerName,
        t: Date.now()
      }
    };

    this._emitter.emit("message", ev);
    timeline.push(ev);
  },

  // Return a copy of the existing timeline so that late-arriving reporters
  // can synchronize to global analytics messages that emitted before they
  // were initialized.
  sync: function () {
    return _.cloneDeep(timeline);
  },

  getEmitter: function () {
    return this._emitter;
  }
};
