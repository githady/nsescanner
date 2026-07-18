import test from 'node:test';
import assert from 'node:assert/strict';
import { getFallbackDataUrl } from '../src/data.js';

test('builds the GitHub Pages fallback data URL from the repo subpath', () => {
  assert.equal(
    getFallbackDataUrl('https://githady.github.io/nsescanner/'),
    'https://githady.github.io/nsescanner/data/stocks.json'
  );
});

test('builds the local development fallback data URL from the app root', () => {
  assert.equal(
    getFallbackDataUrl('http://localhost:8000/'),
    'http://localhost:8000/data/stocks.json'
  );
});
