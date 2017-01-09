"use strict";

const _ = require("lodash");
const EventEmitter = require("events").EventEmitter;

const timeline = [];
const _emitter = new EventEmitter();

module.exports = {
  // Push a global (i.e. not testrun related) analytics event to the timeline.
  // This will cause any reporters that listen to global analytics events to
  // receive the event. A markers list will be started with the current time.
  //
  // NOTE: name must be unique if non-colliding markers are desired.
  push: (eventName, metadata, startMarkerName) => {
    startMarkerName = startMarkerName ? startMarkerName : "start";

    const ev = {
      type: "analytics-event",
      data: {
        name: eventName,

        markers: [{
          name: startMarkerName,
          t: Date.now()
        }],

        metadata
      }
    };

    _emitter.emit("message", ev);
    timeline.push(ev);
  },

  // Mark an event's timeline with a marker named markerName at current time.
  // Default to a marker name of "end" if one isn't supplied.
  mark: (eventName, markerName) => {
    markerName = markerName ? markerName : "end";

    const ev = {
      type: "analytics-event-mark",
      eventName,
      data: {
        name: markerName,
        t: Date.now()
      }
    };

    _emitter.emit("message", ev);
    timeline.push(ev);
  },

  // Return a copy of the existing timeline so that late-arriving reporters
  // can synchronize to global analytics messages that emitted before they
  // were initialized.
  sync: () => {
    return _.cloneDeep(timeline);
  },

  getEmitter: () => {
    return _emitter;
  }
};
