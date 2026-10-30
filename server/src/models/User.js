import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['citizen', 'police', 'admin'];
/** Roles that may read other people's reports, alerts and camera feeds. */
export const STAFF_ROLES = ['police', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ROLES,
      default: 'citizen',
    },
    phone: { type: String, trim: true, default: '', maxlength: 30 },
    // Populated for police accounts: which station's code was used at signup.
    station: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PoliceStation',
      default: null,
    },
    badgeId: { type: String, trim: true, default: '', maxlength: 40 },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, createdAt: -1 });

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export const User = mongoose.model('User', userSchema);
