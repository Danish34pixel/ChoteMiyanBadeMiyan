import { AppError } from '../../../utils/app-error.js';
import {
  hashPassword,
  verifyPassword,
} from '../../../utils/password.js';

export function createIdentityAccountService({
  userModel,
  otpService,
}) {
  return {
    async registerMobileCustomer({
      name,
      email,
      password,
      mobile,
      verificationToken,
    }) {
      const existingUser = await userModel
        .findOne({ email, role: 'customer', isActive: true })
        .select('+password');

      if (existingUser) {
        if (!(await verifyPassword(password, existingUser.password))) {
          throw new AppError('Account credentials could not be verified', 401);
        }

        const mobileInUse = await userModel.exists({
          mobile,
          _id: { $ne: existingUser._id },
        });

        if (mobileInUse) {
          throw new AppError(
            'An account with this mobile number already exists',
            409,
          );
        }

        await otpService.consumeSignupVerification({
          mobile,
          verificationToken,
        });

        const updatedUser = await userModel.findOneAndUpdate(
          {
            _id: existingUser._id,
            email,
            mobile: existingUser.mobile ?? null,
            role: 'customer',
            isActive: true,
          },
          {
            $set: {
              mobile,
              mobileVerifiedAt: new Date(),
            },
          },
          { new: true, runValidators: true },
        );

        if (!updatedUser) {
          throw new AppError(
            'An account with this mobile number already exists',
            409,
          );
        }

        return updatedUser;
      }

      if (await userModel.exists({ mobile })) {
        throw new AppError(
          'An account with this mobile number already exists',
          409,
        );
      }

      await otpService.consumeSignupVerification({
        mobile,
        verificationToken,
      });

      return userModel.create({
        name,
        email,
        password: await hashPassword(password),
        mobile,
        mobileVerifiedAt: new Date(),
        role: 'customer',
      });
    },
  };
}
