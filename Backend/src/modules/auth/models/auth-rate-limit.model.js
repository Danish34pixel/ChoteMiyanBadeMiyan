import mongoose from 'mongoose';

const authRateLimitSchema = new mongoose.Schema(
  {
    bucketKey: {
      type: String,
      required: true,
      unique: true,
    },
    windowStartedAt: {
      type: Date,
      required: true,
    },
    count: {
      type: Number,
      required: true,
      min: 1,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true },
);

const AuthRateLimit =
  mongoose.models.AuthRateLimit ??
  mongoose.model('AuthRateLimit', authRateLimitSchema);

export default AuthRateLimit;
