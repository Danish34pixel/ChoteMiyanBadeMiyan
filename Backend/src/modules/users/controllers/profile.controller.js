import { getIdentityRuntime } from '../../auth/services/identity-runtime.js';

export async function getProfile(req, res) {
  const profile = await getIdentityRuntime().profileService.getProfile(
    req.auth.userId,
  );

  res.status(200).json({ success: true, data: { profile } });
}

export async function updateProfile(req, res) {
  const profile = await getIdentityRuntime().profileService.updateProfile(
    req.auth.userId,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { profile },
  });
}

export async function listAddresses(req, res) {
  const addresses = await getIdentityRuntime().profileService.listAddresses(
    req.auth.userId,
  );

  res.status(200).json({ success: true, data: { addresses } });
}

export async function addAddress(req, res) {
  const address = await getIdentityRuntime().profileService.addAddress(
    req.auth.userId,
    req.body,
  );

  res.status(201).json({
    success: true,
    message: 'Address added successfully',
    data: { address },
  });
}

export async function updateAddress(req, res) {
  const address = await getIdentityRuntime().profileService.updateAddress(
    req.auth.userId,
    req.params.addressId,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: 'Address updated successfully',
    data: { address },
  });
}

export async function deleteAddress(req, res) {
  const result = await getIdentityRuntime().profileService.deleteAddress(
    req.auth.userId,
    req.params.addressId,
  );

  res.status(200).json({
    success: true,
    message: 'Address deleted successfully',
    data: result,
  });
}
