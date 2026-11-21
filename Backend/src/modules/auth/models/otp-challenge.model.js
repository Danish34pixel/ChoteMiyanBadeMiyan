import mongoose from 'mongoose';

const otpChallengeSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['signup', 'login'],
      required: true,
    },
    codeHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
    resendAvailableAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    verifiedAt: Date,
    verificationTokenHash: {
      type: String,
      select: false,
    },
    consumedAt: Date,
  },
  { timestamps: true },
);

otpChallengeSchema.index({ mobile: 1, purpose: 1 }, { unique: true });

const OtpChallenge =
  mongoose.models.OtpChallenge ??
  mongoose.model('OtpChallenge', otpChallengeSchema);

export default OtpChallenge;
