import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { createIdentityAccountService } from '../../src/modules/auth/services/identity-account.service.js';

const signupInput = {
  name: 'Customer',
  email: 'customer@example.com',
  password: 'StrongPass123',
  mobile: '+919876543210',
  verificationToken: 'A'.repeat(43),
};

function query(value) {
  const result = Promise.resolve(value);
  result.select = () => result;
  return result;
}

test('mobile signup consumes a verified proof and hashes the password', async () => {
  let created;
  let consumed;
  const service = createIdentityAccountService({
    userModel: {
      findOne() {
        return query(null);
      },
      async exists() {
        return null;
      },
      async create(user) {
        created = user;
        return { id: 'customer-id', ...user };
      },
    },
    otpService: {
      async consumeSignupVerification(input) {
        consumed = input;
      },
    },
  });

  const user = await service.registerMobileCustomer(signupInput);

  assert.deepEqual(consumed, {
    mobile: signupInput.mobile,
    verificationToken: signupInput.verificationToken,
  });
  assert.equal(created.name, signupInput.name);
  assert.equal(created.email, signupInput.email);
  assert.equal(created.mobile, signupInput.mobile);
  assert.equal(created.role, 'customer');
  assert.notEqual(created.password, signupInput.password);
  assert.equal(await bcrypt.compare(signupInput.password, created.password), true);
  assert.equal(user.id, 'customer-id');
});

test('mobile signup rejects existing email or mobile before consuming OTP proof', async () => {
  let proofConsumed = false;
  const service = createIdentityAccountService({
    userModel: {
      findOne() {
        return query(null);
      },
      async exists() {
        return { _id: 'existing-customer' };
      },
      async create() {
        throw new Error('Should not create a duplicate customer');
      },
    },
    otpService: {
      async consumeSignupVerification() {
        proofConsumed = true;
      },
    },
  });

  await assert.rejects(
    service.registerMobileCustomer(signupInput),
    (error) => error.statusCode === 409,
  );
  assert.equal(proofConsumed, false);
});

test('verified mobile signup links an existing account only after password confirmation', async () => {
  const passwordHash = await bcrypt.hash(signupInput.password, 4);
  const existingUser = {
    _id: 'existing-user',
    name: 'Existing Customer',
    email: signupInput.email,
    password: passwordHash,
    mobile: undefined,
    role: 'customer',
    isActive: true,
  };
  let updated;
  let proofConsumed = false;
  const service = createIdentityAccountService({
    userModel: {
      findOne() {
        return query(existingUser);
      },
      async exists() {
        return null;
      },
      async findOneAndUpdate(filter, update) {
        assert.equal(filter._id, existingUser._id);
        updated = { ...existingUser, ...update.$set };
        return updated;
      },
    },
    otpService: {
      async consumeSignupVerification() {
        proofConsumed = true;
      },
    },
  });

  const user = await service.registerMobileCustomer(signupInput);

  assert.equal(proofConsumed, true);
  assert.equal(user.name, 'Existing Customer');
  assert.equal(user.mobile, signupInput.mobile);
  assert.ok(user.mobileVerifiedAt instanceof Date);
  assert.equal(updated.password, passwordHash);
});

test('existing account linking rejects an incorrect password without consuming proof', async () => {
  const passwordHash = await bcrypt.hash(signupInput.password, 4);
  let proofConsumed = false;
  const service = createIdentityAccountService({
    userModel: {
      findOne() {
        return query({
          _id: 'existing-user',
          password: passwordHash,
          role: 'customer',
          isActive: true,
        });
      },
      async exists() {
        return null;
      },
    },
    otpService: {
      async consumeSignupVerification() {
        proofConsumed = true;
      },
    },
  });

  await assert.rejects(
    service.registerMobileCustomer({
      ...signupInput,
      password: 'IncorrectPass123',
    }),
    (error) => error.statusCode === 401,
  );
  assert.equal(proofConsumed, false);
});
