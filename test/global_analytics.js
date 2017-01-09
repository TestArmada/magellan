/* eslint no-undef: 0, no-unused-expressions: 0, no-magic-numbers: 0 */
"use strict";
const expect = require("chai").expect;
const globalAnalytics = require("../src/global_analytics");

describe("globalAnalytics", () => {

  it("should create an empty timeline", () => {
    expect(globalAnalytics.getEmitter()).to.not.be.null;
    expect(globalAnalytics.sync()).to.be.empty;
  });

  it("should push data to the timeline using push()", () => {
    globalAnalytics.push("TestEvent", "Metadata", "Marker");
    expect(globalAnalytics.sync()[0]).to.include({type: "analytics-event"});
    expect(globalAnalytics.sync()[0].data).to.include({name: "TestEvent"});
    expect(globalAnalytics.sync()[0].data).to.include({metadata: "Metadata"});
    expect(globalAnalytics.sync()[0].data.markers[0]).to.include({name: "Marker"});
    expect(globalAnalytics.sync()[0].data.markers[0]).to.include.key("t");
  });

  it("should push with a default marker name if one is not provided", () => {
    globalAnalytics.push("EventName", "metadata");
    expect(globalAnalytics.sync()[1].data.markers[0]).to.include({name: "start"});
  });

  it("should mark", () => {
    globalAnalytics.mark("EventName", "MarkerName");
    expect(globalAnalytics.sync()[2]).to.include({type: "analytics-event-mark"});
    expect(globalAnalytics.sync()[2]).to.include({eventName: "EventName"});
    expect(globalAnalytics.sync()[2].data).to.include({name: "MarkerName"});
  });

  it("should use a default marker name if one is not provided", () => {
    globalAnalytics.mark("EventName");
    expect(globalAnalytics.sync()[3].data).to.include({name: "end"});
  });


});
