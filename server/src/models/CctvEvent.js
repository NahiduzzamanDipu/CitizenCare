import mongoose from 'mongoose';

const cctvEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cameraId: { type: String, default: '' },
    place: { type: String, default: '' },
    weaponDetected: { type: Boolean, required: true },
    labels: [{ type: String }],
    detections: { type: mongoose.Schema.Types.Mixed, default: [] },
    imageUrl: { type: String, default: '' },
    frameWidth: { type: Number },
    frameHeight: { type: Number },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

cctvEventSchema.index({ createdAt: -1 });
cctvEventSchema.index({ weaponDetected: 1, createdAt: -1 });

export const CctvEvent = mongoose.model('CctvEvent', cctvEventSchema);
