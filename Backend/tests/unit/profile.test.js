import assert from 'node:assert/strict';
import test from 'node:test';
import { createProfileService } from '../../src/modules/users/services/profile.service.js';

const ownerId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const addressId = 'cccccccccccccccccccccccc';
const otherUserId = 'dddddddddddddddddddddddd';

function createHarness() {
  const user = {
    _id: ownerId,
    name: 'Customer',
    email: null,
    mobile: '+919876543210',
    mobileVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    role: 'customer',
    isActive: true,
    password: 'must-not-be-returned',
    refreshTokenHash: 'must-not-be-returned',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    addresses: [],
  };

  user.addresses.id = (id) =>
    user.addresses.find((address) => String(address._id) === String(id));

  function isOwner(query) {
    return (
      String(query._id) === ownerId &&
      query.role === 'customer' &&
      query.isActive === true
    );
  }

  const userModel = {
    async findOne(query) {
      return isOwner(query) ? user : null;
    },
    async findOneAndUpdate(query, update) {
      if (!isOwner(query)) return null;

      const targetId = query['addresses._id'];
      if (targetId && !user.addresses.id(targetId)) return null;

      if (update.$set) {
        for (const [path, value] of Object.entries(update.$set)) {
          if (path.startsWith('addresses.$.')) {
            const field = path.slice('addresses.$.'.length);
            user.addresses.id(targetId)[field] = value;
          } else {
            user[path] = value;
          }
        }
      }

      if (update.$push?.addresses) {
        const address = {
          _id: addressId,
          ...update.$push.addresses,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        };
        user.addresses.push(address);
      }

      if (update.$pull?.addresses) {
        user.addresses = user.addresses.filter(
          (address) =>
            String(address._id) !== String(update.$pull.addresses._id),
        );
        user.addresses.id = (id) =>
          user.addresses.find(
            (address) => String(address._id) === String(id),
          );
      }

      return user;
    },
  };

  return {
    user,
    service: createProfileService({ userModel }),
  };
}

const address = {
  name: 'Recipient',
  mobile: '+919876543210',
  pinCode: '462001',
  city: 'Bhopal',
  state: 'Madhya Pradesh',
  addressLine: '12 Market Road',
};

test('profile responses include customer fields but exclude credentials and role', async () => {
  const harness = createHarness();
  const profile = await harness.service.getProfile(ownerId);

  assert.equal(profile.id, ownerId);
  assert.equal(profile.name, 'Customer');
  assert.equal(profile.mobile, '+919876543210');
  assert.equal('role' in profile, false);
  assert.equal('password' in profile, false);
  assert.equal('refreshTokenHash' in profile, false);
});

test('profile updates accept editable fields without permitting role or mobile changes', async () => {
  const harness = createHarness();
  const profile = await harness.service.updateProfile(ownerId, {
    name: 'Updated Customer',
  });

  assert.equal(profile.name, 'Updated Customer');
  assert.equal(harness.user.mobile, '+919876543210');
  assert.equal(harness.user.role, 'customer');
});

test('addresses can be created, updated, listed, and deleted by their owner', async () => {
  const harness = createHarness();
  const created = await harness.service.addAddress(ownerId, address);

  assert.equal(created.id, addressId);
  assert.equal(created.pinCode, '462001');

  const updated = await harness.service.updateAddress(ownerId, addressId, {
    city: 'Indore',
  });
  assert.equal(updated.city, 'Indore');

  const addresses = await harness.service.listAddresses(ownerId);
  assert.equal(addresses.length, 1);
  assert.equal(addresses[0].city, 'Indore');

  assert.deepEqual(
    await harness.service.deleteAddress(ownerId, addressId),
    { id: addressId, deleted: true },
  );
  assert.deepEqual(await harness.service.listAddresses(ownerId), []);
});

test('address operations reject a user who does not own the address', async () => {
  const harness = createHarness();
  harness.user.addresses.push({ _id: addressId, ...address });

  await assert.rejects(
    harness.service.updateAddress(otherUserId, addressId, { city: 'Indore' }),
    (error) => error.statusCode === 404,
  );
  await assert.rejects(
    harness.service.deleteAddress(otherUserId, addressId),
    (error) => error.statusCode === 404,
  );
});
