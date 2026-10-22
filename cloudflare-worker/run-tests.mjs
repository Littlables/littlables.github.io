#!/usr/bin/env node
/**
 * Test runner for Cloudflare Worker unit tests.
 * Runs all test files with clean, scannable output for CI logs.
 *
 * Usage: node cloudflare-worker/run-tests.mjs
 * Exit code: 0 if all pass, 1 if any fail.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_FILES = [
  'src/index.test.mjs',
  'src/news-storage.test.mjs',
  'src/embedding-classifier.test.mjs',
  'src/staggered-sync.test.mjs',
];

console.log('═'.repeat(60));
console.log('  Cloudflare Worker Unit Tests');
console.log('═'.repeat(60));
console.log('');

let totalPass = 0;
let totalFail = 0;
const failures = [];

for (const testFile of TEST_FILES) {
  const fullPath = path.join(__dirname, testFile);
  console.log(`\n▶ ${testFile}`);
  console.log('─'.repeat(60));

  const result = await new Promise((resolve) => {
    const proc = spawn('node', ['--test', fullPath], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });

  // Parse TAP output for pass/fail counts
  const passMatch = result.stdout.match(/ℹ pass (\d+)/);
  const failMatch = result.stdout.match(/ℹ fail (\d+)/);
  const pass = passMatch ? parseInt(passMatch[1], 10) : 0;
  const fail = failMatch ? parseInt(failMatch[1], 10) : (result.code !== 0 ? 1 : 0);

  totalPass += pass;
  totalFail += fail;

  if (fail > 0) {
    console.log(`  ✖ FAILED: ${pass} passed, ${fail} failed`);
    failures.push(testFile);
    // Show failing test names
    const failLines = result.stdout.split('\n').filter((l) => l.includes('✖') && !l.includes('failing tests'));
    for (const line of failLines.slice(0, 10)) {
      console.log('    ' + line.trim());
    }
    if (result.stderr) {
      console.log('\n  Error output:');
      console.log(result.stderr.split('\n').slice(0, 20).join('\n'));
    }
  } else {
    console.log(`  ✔ PASSED: ${pass} tests`);
  }
}

console.log('');
console.log('═'.repeat(60));
console.log(`  TOTAL: ${totalPass} passed, ${totalFail} failed`);
if (failures.length > 0) {
  console.log(`  Failed files: ${failures.join(', ')}`);
}
console.log('═'.repeat(60));

process.exit(totalFail > 0 ? 1 : 0);
