import mongoose from 'mongoose';

const authSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['customer', 'admin'],
      required: true,
      default: 'customer',
    },
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
    lastUsedAt: Date,
    revokedAt: Date,
  },
  { timestamps: true },
);

const AuthSession =
  mongoose.models.AuthSession ??
  mongoose.model('AuthSession', authSessionSchema);

export default AuthSession;
