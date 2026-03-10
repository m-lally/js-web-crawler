import test from 'node:test';
import assert from 'node:assert';
import * as cheerio from 'cheerio';
import WebCrawler from './webCrawler.js';

test('WebCrawler Extraction Methods', async (t) => {
  let crawler = new WebCrawler();
  const mockHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Test Page</title>
      <meta name="description" content="A test description">
      <meta property="og:title" content="OpenGraph Title">
      <meta name="twitter:card" content="summary_large_image">
      <link rel="stylesheet" href="styles.css">
      <script src="script.js"></script>
    </head>
    <body>
      <h1>Main Heading</h1>
      <p>This is a short paragraph.</p>
      <p>This is a much longer paragraph that will definitely exceed the twenty character limit set in the extraction logic.</p>
      <img src="image.jpg" alt="A test image" title="Image title" width="100" height="200">
      <a href="/link1">Link 1</a>
      <a href="https://external.com/link2">Link 2</a>
      <script>console.log("inline script");</script>
      <style>body { color: red; }</style>
    </body>
    </html>
  `;
  const $ = cheerio.load(mockHtml);

  await t.test('extractMetaTags should extract standard, og, and twitter meta tags', () => {
    const metaTags = crawler.extractMetaTags($);
    assert.strictEqual(metaTags.general.description, 'A test description');
    assert.strictEqual(metaTags.openGraph.title, 'OpenGraph Title');
    assert.strictEqual(metaTags.twitter.card, 'summary_large_image');
  });

  await t.test('extractTextContent should calculate word count and paragraph count', () => {
    const textContent = crawler.extractTextContent($);
    // Ignore internal scripts/styles, count words in body
    assert.strictEqual(textContent.paragraphsCount, 2); // Both paragraphs are > 20 chars
    assert.ok(textContent.wordCount > 0);
    // Should not include inline script text
    assert.ok(!textContent.preview.includes('inline script'));
  });

  await t.test('extractScriptsAndStyles should find external resources', () => {
    const resources = crawler.extractScriptsAndStyles($);
    assert.ok(resources.scripts.includes('script.js'));
    assert.ok(resources.stylesheets.includes('styles.css'));
  });

  await t.test('crawlPage should return comprehensive result object', async () => {
    const mockUrl = 'https://example.com';
    const mockResponse = {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      data: `
        <html lang="en">
        <head><title>Test</title><meta name="description" content="desc"></head>
        <body><p>Hello world from a paragraph that needs to be over twenty chars.</p></body>
        </html>
      `,
      request: { res: { responseUrl: mockUrl } }
    };

    // Mock internal methods so it doesn't make an external HTTP request
    crawler.isAllowedByRobots = async () => true;
    crawler.httpClient.get = async () => mockResponse;

    const result = await crawler.crawlPage(mockUrl);

    assert.ok(result);
    assert.strictEqual(result.url, mockUrl);
    assert.strictEqual(result.language, 'en');
    assert.strictEqual(result.title, 'Test');
    assert.strictEqual(result.meta.general.description, 'desc');
    assert.ok(result.textContent.wordCount > 0);
    assert.strictEqual(result.textContent.paragraphsCount, 1);
  });
});
