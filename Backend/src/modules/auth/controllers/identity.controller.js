import { getIdentityRuntime } from '../services/identity-runtime.js';

function publicCustomer(user) {
  return {
    id: String(user._id ?? user.id),
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    mobileVerifiedAt: user.mobileVerifiedAt,
    createdAt: user.createdAt,
  };
}

export async function requestOtp(req, res) {
  const result = await getIdentityRuntime().otpService.request({
    ...req.body,
    ip: req.ip,
  });

  const response = {
    success: true,
    message: 'If the number is eligible, the verification code request was accepted',
    data: { accepted: result.accepted },
  };

  if (result.developmentOtp) {
    response.data.developmentOtp = result.developmentOtp;
  }

  res.status(202).json(response);
}

export async function verifyOtp(req, res) {
  const { purpose, ...input } = req.body;
  const result = await getIdentityRuntime().otpService.verify({
    ...input,
    purpose,
    ip: req.ip,
    tokenService: getIdentityRuntime().sessionService,
  });

  if (purpose === 'signup') {
    res.status(200).json({
      success: true,
      message: 'Mobile number verified',
      data: { verificationToken: result.verificationToken },
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Authentication successful',
    data: result,
  });
}

export async function signupWithMobile(req, res) {
  const { name, email, password, mobile, verificationToken } = req.body;
  const { accountService } = getIdentityRuntime();
  const user = await accountService.registerMobileCustomer({
    name,
    email,
    password,
    mobile,
    verificationToken,
  });

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: { user: publicCustomer(user) },
  });
}

export async function refreshTokens(req, res) {
  const data = await getIdentityRuntime().sessionService.refresh(
    req.body.refreshToken,
  );

  res.status(200).json({
    success: true,
    message: 'Tokens refreshed',
    data,
  });
}

export async function logout(req, res) {
  await getIdentityRuntime().sessionService.revoke(
    req.auth.sessionId,
    req.auth.userId,
  );

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
    data: { loggedOut: true },
  });
}
