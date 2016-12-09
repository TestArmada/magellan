var BaseListener = require('../src/listener');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

var expect = chai.expect;
chai.use(chaiAsPromised);

describe('listener', function() {

  it('should act like a class', function() {
    expect(new BaseListener).to.be.an.instanceof(BaseListener);
  });

  it('should listenTo', function() {
    var myListener = new BaseListener();
    myListener.listenTo();
    expect(myListener.listenTo).to.not.be.null;
  });

  it('should flush', function() {
    var myListener = new BaseListener();
    myListener.flush().then(() => {});
    expect(myListener.flush).to.not.be.null;
  });

  it('should initialize', function() {
    var myListener = new BaseListener();
    return expect(myListener.initialize()).to.be.fulfilled;
  });
});
