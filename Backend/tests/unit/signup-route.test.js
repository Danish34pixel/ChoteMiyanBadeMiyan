import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import test from 'node:test';
import app from '../../src/app.js';
import User from '../../src/modules/users/models/user.model.js';
import { startTestServer } from '../helpers/http.js';

test('signup route returns validation errors before accessing the database', async () => {
  const testServer = await startTestServer(app);
  const url = `${testServer.baseUrl}/api/v1/auth/signup`;

  try {
    const invalidRequests = [
      {
        body: {
          email: 'danish@example.com',
          password: 'StrongPass123',
        },
        field: 'name',
      },
      {
        body: {
          name: 'Danish Khan',
          email: 'invalid-email',
          password: 'StrongPass123',
        },
        field: 'email',
      },
      {
        body: {
          name: 'Danish Khan',
          email: 'danish@example.com',
          password: 'short',
        },
        field: 'password',
      },
    ];

    for (const { body, field } of invalidRequests) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      const requestId = response.headers.get('x-request-id');

      assert.equal(response.status, 400);
      assert.match(requestId, /^[0-9a-f-]{36}$/i);
      assert.equal(result.success, false);
      assert.equal(result.message, 'Validation failed');
      assert.equal(result.requestId, requestId);
      assert.ok(result.errors.some((error) => error.field === field));
      assert.ok(result.errors.every((error) => error.field && error.message));
    }
  } finally {
    await testServer.close();
  }
});

test('signup creates a customer account directly and hashes the password', async (t) => {
  const createdAt = new Date('2026-01-02T03:04:05.000Z');
  const password = 'StrongPass123';
  const address = {
    name: 'Test Customer',
    mobile: '+919876543210',
    pinCode: '110001',
    city: 'New Delhi',
    state: 'Delhi',
    addressLine: '12 Market Road',
  };
  let createdRecord;

  t.mock.method(User, 'exists', async () => null);
  t.mock.method(User, 'create', async (record) => {
    createdRecord = record;
    return {
      id: 'customer-123',
      ...record,
      isActive: true,
      createdAt,
    };
  });
  const testServer = await startTestServer(app);

  try {
    const response = await fetch(
      `${testServer.baseUrl}/api/v1/auth/signup`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: '  Test Customer  ',
          email: 'TEST@example.com',
          password,
          address,
        }),
      },
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.user.id, 'customer-123');
    assert.equal(body.data.user.name, 'Test Customer');
    assert.equal(body.data.user.email, 'test@example.com');
    assert.equal(body.data.user.role, 'customer');
    assert.equal('password' in body.data.user, false);
    assert.deepEqual(createdRecord.addresses, [address]);
    assert.notEqual(createdRecord.password, password);
    assert.equal(await bcrypt.compare(password, createdRecord.password), true);
  } finally {
    await testServer.close();
  }
});

test('signup validates a provided delivery address before accessing the database', async () => {
  const testServer = await startTestServer(app);

  try {
    const response = await fetch(
      `${testServer.baseUrl}/api/v1/auth/signup`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Customer',
          email: 'customer@example.com',
          password: 'StrongPass123',
          address: {
            name: 'Test Customer',
            mobile: '+919876543210',
            pinCode: '123',
            city: 'City',
            state: 'State',
            addressLine: 'Address',
          },
        }),
      },
    );
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.ok(result.errors.some((error) => error.field === 'address.pinCode'));
  } finally {
    await testServer.close();
  }
});

test('signup returns a conflict for an existing email without creating a user', async (t) => {
  t.mock.method(User, 'exists', async () => ({ _id: 'existing-user' }));
  t.mock.method(User, 'create', async () => {
    throw new Error('User.create must not be called for a duplicate email');
  });
  const testServer = await startTestServer(app);

  try {
    const response = await fetch(
      `${testServer.baseUrl}/api/v1/auth/signup`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Customer',
          email: 'existing@example.com',
          password: 'StrongPass123',
        }),
      },
    );
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
    assert.equal(body.message, 'An account with this email already exists');
  } finally {
    await testServer.close();
  }
});

