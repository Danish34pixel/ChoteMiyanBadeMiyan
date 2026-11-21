import assert from 'node:assert/strict';
import test from 'node:test';
import { mobileNumberSchema, normalizeMobileNumber } from '../../src/modules/users/validators/mobile.validator.js';

test('mobile numbers normalize to E.164 format', () => {
  assert.equal(normalizeMobileNumber('98765 43210'), '+919876543210');
  assert.equal(normalizeMobileNumber('91-98765-43210'), '+919876543210');
  assert.equal(normalizeMobileNumber('+1 (415) 555-2671'), '+14155552671');
  assert.equal(mobileNumberSchema.parse('9876543210'), '+919876543210');
});

test('invalid mobile numbers are rejected', () => {
  for (const mobile of ['', '12345', '+0123456789', 'not-a-number']) {
    assert.equal(mobileNumberSchema.safeParse(mobile).success, false);
  }
});
