import { AppError } from '../../utils/app-error.js';

const MSG91_FLOW_API = 'https://control.msg91.com/api/v5/flow';

export function createMsg91SmsAdapter({
  authKey,
  flowTemplateId,
  otpVariable,
  fetchImpl = fetch,
}) {
  if (!authKey || !flowTemplateId || !otpVariable) {
    throw new Error('MSG91 SMS configuration is incomplete');
  }

  return {
    async sendOtp({ mobile, otp }) {
      let response;
      let result;

      try {
        response = await fetchImpl(MSG91_FLOW_API, {
          method: 'POST',
          headers: {
            authkey: authKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            template_id: flowTemplateId,
            recipients: [
              {
                mobiles: mobile.replace('+', ''),
                [otpVariable]: otp,
              },
            ],
          }),
          signal: AbortSignal.timeout(10000),
        });

        result = await response.json();
      } catch {
        throw new AppError('Unable to deliver verification code', 502);
      }

      if (!response.ok || result?.type !== 'success') {
        throw new AppError('Unable to deliver verification code', 502);
      }
    },
  };
}
