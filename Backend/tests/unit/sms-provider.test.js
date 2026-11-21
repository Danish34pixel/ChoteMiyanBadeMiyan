import assert from 'node:assert/strict';
import test from 'node:test';
import { createMsg91SmsAdapter } from '../../src/integrations/sms/msg91.adapter.js';
import { createSmsService } from '../../src/integrations/sms/sms.service.js';

test('MSG91 adapter submits the generated OTP using configured flow fields', async () => {
  let request;
  const adapter = createMsg91SmsAdapter({
    authKey: 'test-auth-key',
    flowTemplateId: 'flow-template',
    otpVariable: 'VAR1',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        async json() {
          return { type: 'success', message: 'provider-message-id' };
        },
      };
    },
  });

  await adapter.sendOtp({ mobile: '+919876543210', otp: '123456' });

  assert.equal(request.url, 'https://control.msg91.com/api/v5/flow');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.authkey, 'test-auth-key');
  assert.deepEqual(JSON.parse(request.options.body), {
    template_id: 'flow-template',
    recipients: [{ mobiles: '919876543210', VAR1: '123456' }],
  });
});

test('MSG91 HTTP, provider, and network failures never report successful delivery', async () => {
  for (const fetchImpl of [
    async () => ({ ok: false, async json() { return { type: 'error' }; } }),
    async () => ({ ok: true, async json() { return { type: 'error' }; } }),
    async () => {
      throw new Error('private transport detail');
    },
  ]) {
    const adapter = createMsg91SmsAdapter({
      authKey: 'secret-auth-key',
      flowTemplateId: 'flow-template',
      otpVariable: 'VAR1',
      fetchImpl,
    });

    await assert.rejects(
      adapter.sendOtp({ mobile: '+919876543210', otp: '123456' }),
      (error) =>
        error.statusCode === 502 &&
        error.message === 'Unable to deliver verification code' &&
        !error.message.includes('secret-auth-key'),
    );
  }
});

test('development OTP delivery requires an explicit non-production flag', async () => {
  const developmentSms = createSmsService({
    NODE_ENV: 'development',
    OTP_DEV_MODE: true,
  });

  assert.deepEqual(
    await developmentSms.sendOtp({
      mobile: '+919876543210',
      otp: '123456',
    }),
    { developmentOtp: '123456' },
  );
  assert.throws(
    () =>
      createSmsService({
        NODE_ENV: 'production',
        OTP_DEV_MODE: true,
      }),
    /forbidden in production/,
  );
  assert.throws(
    () =>
      createSmsService({
        NODE_ENV: 'development',
        OTP_DEV_MODE: false,
        SMS_PROVIDER: 'msg91',
      }),
    /configuration is incomplete/,
  );
});
