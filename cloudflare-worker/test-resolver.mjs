#!/usr/bin/env node

import { resolveGoogleNewsUrls } from './src/google-news-resolver.mjs';

const sourceUrls = process.argv.slice(2);
if (sourceUrls.length === 0) {
  console.error('Usage: node cloudflare-worker/test-resolver.mjs <Google News URL> [Google News URL ...]');
  process.exitCode = 2;
} else {
  console.log(`Testing Google News URL resolution locally for ${sourceUrls.length} URL(s)...`);
  const { resolvedByInput } = await resolveGoogleNewsUrls(sourceUrls);
  let failures = 0;

  for (const { sourceUrl, publisherUrl } of resolvedByInput) {
    if (publisherUrl) {
      console.log(`Resolved: ${publisherUrl}`);
    } else {
      failures++;
      console.error(`Failed:   ${sourceUrl}`);
    }
  }

  console.log(`\n${sourceUrls.length - failures}/${sourceUrls.length} URL(s) resolved.`);
  if (failures > 0) process.exitCode = 1;
}
