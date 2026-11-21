import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { hashPassword } from '../../src/utils/password.js';

test('password hashing uses bcrypt and produces a verifiable hash', async () => {
  const password = 'StrongPass123';
  const hashedPassword = await hashPassword(password);

  assert.notEqual(hashedPassword, password);
  assert.match(hashedPassword, /^\$2[aby]\$12\$/);
  assert.equal(await bcrypt.compare(password, hashedPassword), true);
  assert.equal(await bcrypt.compare('incorrect-password', hashedPassword), false);
});
