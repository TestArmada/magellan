var expect = require('chai').expect;
var global_analytics = require('../src/global_analytics');

describe('global_analytics', function() {

  it('should create an empty timeline', function() {
    expect(global_analytics.getEmitter()).to.not.be.null;
    expect(global_analytics.sync()).to.be.empty;
  });

  it('should push data to the timeline using push()', function() {
    global_analytics.push("TestEvent", "Metadata", "Marker");
    expect(global_analytics.sync()[0]).to.include({type: 'analytics-event'});
    expect(global_analytics.sync()[0].data).to.include({name: 'TestEvent'});
    expect(global_analytics.sync()[0].data).to.include({metadata: 'Metadata'});
    expect(global_analytics.sync()[0].data.markers[0]).to.include({name: 'Marker'});
    expect(global_analytics.sync()[0].data.markers[0]).to.include.key('t');
  });

  it('should push with a default marker name if one is not provided', function() {
    global_analytics.push('EventName', 'metadata');
    expect(global_analytics.sync()[1].data.markers[0]).to.include({name: 'start'});
  });

  it('should mark', function() {
    global_analytics.mark("EventName", "MarkerName");
    expect(global_analytics.sync()[2]).to.include({type: 'analytics-event-mark'});
    expect(global_analytics.sync()[2]).to.include({eventName: 'EventName'});
    expect(global_analytics.sync()[2].data).to.include({name: 'MarkerName'});
  });

  it('should use a default marker name if one is not provided', function() {
    global_analytics.mark('EventName');
    expect(global_analytics.sync()[3].data).to.include({name: 'end'});
  });


});
