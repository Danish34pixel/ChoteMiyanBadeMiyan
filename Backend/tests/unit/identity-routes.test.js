import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../../src/app.js';
import { startTestServer } from '../helpers/http.js';

test('customer profile routes require a customer access token', async () => {
  const testServer = await startTestServer(app);

  try {
    const response = await fetch(
      `${testServer.baseUrl}/api/v1/customer/me/addresses`,
    );
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.message, 'Authentication required');
  } finally {
    await testServer.close();
  }
});

test('identity endpoints validate input before accessing SMS or database services', async () => {
  const testServer = await startTestServer(app);

  try {
    const otpResponse = await fetch(
      `${testServer.baseUrl}/api/v1/auth/otp/request`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mobile: 'invalid', purpose: 'signup' }),
      },
    );
    const otpBody = await otpResponse.json();

    assert.equal(otpResponse.status, 400);
    assert.equal(otpBody.success, false);
    assert.ok(otpBody.errors.some((error) => error.field === 'mobile'));

    const signupResponse = await fetch(
      `${testServer.baseUrl}/api/v1/auth/signup/mobile`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Customer',
          email: 'customer@example.com',
          password: 'StrongPass123',
          mobile: '9876543210',
        }),
      },
    );
    const signupBody = await signupResponse.json();

    assert.equal(signupResponse.status, 400);
    assert.ok(
      signupBody.errors.some((error) => error.field === 'verificationToken'),
    );
  } finally {
    await testServer.close();
  }
});

test('admin password login validates credentials before loading authentication services', async () => {
  const testServer = await startTestServer(app);

  try {
    const invalidEmailResponse = await fetch(
      `${testServer.baseUrl}/api/v1/auth/admin/login`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'StrongPass123',
        }),
      },
    );
    const invalidEmailBody = await invalidEmailResponse.json();
    assert.equal(invalidEmailResponse.status, 400);
    assert.ok(invalidEmailBody.errors.some((error) => error.field === 'email'));

    const missingPasswordResponse = await fetch(
      `${testServer.baseUrl}/api/v1/auth/admin/login`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com' }),
      },
    );
    const missingPasswordBody = await missingPasswordResponse.json();
    assert.equal(missingPasswordResponse.status, 400);
    assert.ok(
      missingPasswordBody.errors.some((error) => error.field === 'password'),
    );
  } finally {
    await testServer.close();
  }
});
