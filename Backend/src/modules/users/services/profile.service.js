import { AppError } from '../../../utils/app-error.js';

function serializeAddress(address) {
  return {
    id: String(address._id ?? address.id),
    name: address.name,
    mobile: address.mobile,
    pinCode: address.pinCode,
    city: address.city,
    state: address.state,
    addressLine: address.addressLine,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

function serializeProfile(user) {
  return {
    id: String(user._id ?? user.id),
    name: user.name,
    email: user.email ?? null,
    mobile: user.mobile ?? null,
    mobileVerifiedAt: user.mobileVerifiedAt ?? null,
    createdAt: user.createdAt,
    addresses: (user.addresses ?? []).map(serializeAddress),
  };
}

function notFound() {
  return new AppError('Customer or address not found', 404);
}

export function createProfileService({ userModel }) {
  return {
    async getProfile(userId) {
      const user = await userModel.findOne({
        _id: userId,
        role: 'customer',
        isActive: true,
      });

      if (!user) {
        throw notFound();
      }

      return serializeProfile(user);
    },

    async updateProfile(userId, { name }) {
      const user = await userModel.findOneAndUpdate(
        { _id: userId, role: 'customer', isActive: true },
        { $set: { name } },
        { new: true, runValidators: true },
      );

      if (!user) {
        throw notFound();
      }

      return serializeProfile(user);
    },

    async listAddresses(userId) {
      const user = await userModel.findOne({
        _id: userId,
        role: 'customer',
        isActive: true,
      });

      if (!user) {
        throw notFound();
      }

      return user.addresses.map(serializeAddress);
    },

    async addAddress(userId, address) {
      const user = await userModel.findOneAndUpdate(
        { _id: userId, role: 'customer', isActive: true },
        { $push: { addresses: address } },
        { new: true, runValidators: true },
      );

      if (!user) {
        throw notFound();
      }

      return serializeAddress(user.addresses.at(-1));
    },

    async updateAddress(userId, addressId, changes) {
      const set = Object.fromEntries(
        Object.entries(changes).map(([field, value]) => [
          `addresses.$.${field}`,
          value,
        ]),
      );
      const user = await userModel.findOneAndUpdate(
        {
          _id: userId,
          role: 'customer',
          isActive: true,
          'addresses._id': addressId,
        },
        { $set: set },
        { new: true, runValidators: true },
      );

      if (!user) {
        throw notFound();
      }

      const address = user.addresses.id(addressId);
      return serializeAddress(address);
    },

    async deleteAddress(userId, addressId) {
      const user = await userModel.findOneAndUpdate(
        {
          _id: userId,
          role: 'customer',
          isActive: true,
          'addresses._id': addressId,
        },
        { $pull: { addresses: { _id: addressId } } },
        { new: true },
      );

      if (!user) {
        throw notFound();
      }

      return { id: addressId, deleted: true };
    },
  };
}
