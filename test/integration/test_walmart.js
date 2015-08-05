describe('Walmart test', function() {
  it('should open the page and assert on Logo', function() {
    browser.get('https://www.walmart.com');
    expect(by.css('.js-logo a').getText()).toContain('Walmart');
  });
});