import mongoose from 'mongoose';

/**
 * A police station. Its `code` is the shared secret an officer must present at
 * registration to be granted the `police` role — see routes/auth.js.
 * The code is `select: false` so it never leaks through a generic query; only
 * the admin portal reads it back explicitly.
 */
const policeStationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 6,
      maxlength: 32,
      select: false,
    },
    district: { type: String, trim: true, default: '', maxlength: 120 },
    address: { type: String, trim: true, default: '', maxlength: 400 },
    phone: { type: String, trim: true, default: '', maxlength: 40 },
    location: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

policeStationSchema.index({ name: 1 });

export const PoliceStation = mongoose.model('PoliceStation', policeStationSchema);
