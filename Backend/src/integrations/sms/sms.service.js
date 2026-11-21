import { createMsg91SmsAdapter } from './msg91.adapter.js';

export function createSmsService(
  environment,
  { fetchImpl = fetch } = {},
) {
  if (environment.OTP_DEV_MODE) {
    if (environment.NODE_ENV === 'production') {
      throw new Error('Development OTP mode is forbidden in production');
    }

    return {
      async sendOtp({ otp }) {
        return { developmentOtp: otp };
      },
    };
  }

  if (environment.SMS_PROVIDER !== 'msg91') {
    throw new Error('Unsupported SMS provider');
  }

  const adapter = createMsg91SmsAdapter({
    authKey: environment.MSG91_AUTH_KEY,
    flowTemplateId: environment.MSG91_FLOW_TEMPLATE_ID,
    otpVariable: environment.MSG91_OTP_VARIABLE,
    fetchImpl,
  });

  return {
    async sendOtp(message) {
      await adapter.sendOtp(message);
      return { developmentOtp: null };
    },
  };
}
