import assert from 'node:assert/strict';
import test from 'node:test';
import User from '../../src/modules/users/models/user.model.js';

test('user model applies customer defaults and hides password from JSON', () => {
  const user = new User({
    name: ' Danish Khan ',
    email: ' DANISH@example.com ',
    password: 'bcrypt-hash',
  });

  assert.equal(user.name, 'Danish Khan');
  assert.equal(user.email, 'danish@example.com');
  assert.equal(user.role, 'customer');
  assert.equal(user.isActive, true);
  assert.equal(User.schema.path('password').options.select, false);

  const serializedUser = user.toJSON();
  assert.equal('password' in serializedUser, false);
  assert.equal('_id' in serializedUser, true);
});

test('user model permits only customer and provisioned admin roles', () => {
  const user = new User({
    name: 'Danish Khan',
    email: 'danish@example.com',
    password: 'bcrypt-hash',
    role: 'admin',
  });

  assert.equal(user.validateSync(), undefined);
  user.role = 'owner';
  assert.equal(user.validateSync().errors.role.kind, 'enum');
});

test('user model supports verified mobile identity and address subdocuments', () => {
  const user = new User({
    name: 'Customer',
    email: 'customer@example.com',
    password: 'bcrypt-hash',
    mobile: '+919876543210',
    mobileVerifiedAt: new Date(),
    addresses: [
      {
        name: 'Recipient',
        mobile: '+919876543210',
        pinCode: '462001',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        addressLine: '12 Market Road',
      },
    ],
  });

  assert.equal(user.validateSync(), undefined);
  assert.equal(User.schema.path('email').options.required, true);
  assert.equal(User.schema.path('password').options.required, true);
  assert.equal(User.schema.path('mobile').options.unique, true);
  assert.equal(user.addresses.length, 1);
  assert.equal(user.toJSON().addresses[0].addressLine, '12 Market Road');
  assert.equal('password' in user.toJSON(), false);
});
