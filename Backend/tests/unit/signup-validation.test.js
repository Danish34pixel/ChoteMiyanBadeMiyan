import assert from 'node:assert/strict';
import test from 'node:test';
import { signupSchema } from '../../src/modules/auth/validators/signup.validator.js';

test('signup validation requires a non-empty name', () => {
  const missingName = signupSchema.safeParse({
    email: 'danish@example.com',
    password: 'StrongPass123',
  });
  const emptyName = signupSchema.safeParse({
    name: '  ',
    email: 'danish@example.com',
    password: 'StrongPass123',
  });

  assert.equal(missingName.success, false);
  assert.equal(missingName.error.issues[0].message, 'Name is required');
  assert.equal(emptyName.success, false);
  assert.equal(emptyName.error.issues[0].message, 'Name is required');
});

test('signup validation rejects malformed email addresses', () => {
  const result = signupSchema.safeParse({
    name: 'Danish Khan',
    email: 'not-an-email',
    password: 'StrongPass123',
  });

  assert.equal(result.success, false);
  assert.equal(result.error.issues[0].path[0], 'email');
});

test('signup validation requires passwords to contain at least 8 characters', () => {
  const result = signupSchema.safeParse({
    name: 'Danish Khan',
    email: 'danish@example.com',
    password: 'short',
  });

  assert.equal(result.success, false);
  assert.equal(result.error.issues[0].path[0], 'password');
});

test('signup normalizes email and ignores unrecognized role input', () => {
  const result = signupSchema.safeParse({
    name: ' Danish Khan ',
    email: '  DANISH@example.com ',
    password: 'StrongPass123',
    role: 'admin',
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    name: 'Danish Khan',
    email: 'danish@example.com',
    password: 'StrongPass123',
  });
});

