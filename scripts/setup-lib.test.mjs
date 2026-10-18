import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newSessionSecret, passphraseProblem } from './setup-lib.mjs';

test('accepts a passphrase of at least twelve characters', () => {
  assert.equal(passphraseProblem('correct horse battery', 'correct horse battery'), null);
  assert.equal(passphraseProblem('123456789012', '123456789012'), null);
});

test('rejects a short passphrase', () => {
  assert.match(passphraseProblem('short', 'short') ?? '', /at least 12/);
  assert.match(passphraseProblem('12345678901', '12345678901') ?? '', /at least 12/);
});

test('rejects a passphrase that does not match its confirmation', () => {
  assert.match(
    passphraseProblem('correct horse battery', 'correct horse batter') ?? '',
    /do not match/,
  );
});

test('generates a long random session secret each time', () => {
  const first = newSessionSecret();
  assert.ok(first.length >= 32);
  assert.notEqual(first, newSessionSecret());
});
