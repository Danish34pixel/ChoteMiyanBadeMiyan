import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    mobile: {
      type: String,
      unique: true,
      sparse: true,
      match: /^\+[1-9]\d{7,14}$/,
    },
    mobileVerifiedAt: {
      type: Date,
    },
    addresses: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, required: true, trim: true, maxlength: 100 },
            mobile: {
              type: String,
              required: true,
              match: /^\+[1-9]\d{7,14}$/,
            },
            pinCode: { type: String, required: true, match: /^\d{6}$/ },
            city: { type: String, required: true, trim: true, maxlength: 100 },
            state: { type: String, required: true, trim: true, maxlength: 100 },
            addressLine: {
              type: String,
              required: true,
              trim: true,
              maxlength: 500,
            },
          },
          { timestamps: true },
        ),
      ],
      default: [],
    },
    role: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'customer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform(_document, returnedObject) {
    delete returnedObject.password;
    delete returnedObject.__v;
    return returnedObject;
  },
});

const User = mongoose.models.User ?? mongoose.model('User', userSchema);

export default User;
