import mongoose from 'mongoose';

const crimeReportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 8000 },
    crimeType: {
      type: String,
      required: true,
      enum: [
        'theft',
        'assault',
        'vandalism',
        'traffic',
        'domestic',
        'drugs',
        'other',
      ],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(v) {
            return (
              Array.isArray(v) &&
              v.length === 2 &&
              typeof v[0] === 'number' &&
              typeof v[1] === 'number'
            );
          },
          message: 'coordinates must be [lng, lat]',
        },
      },
      address: { type: String, default: '' },
    },
    media: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video'], default: 'image' },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'verified', 'fake', 'resolved'],
      default: 'pending',
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    note: { type: String, maxlength: 2000 },
  },
  { timestamps: true }
);

crimeReportSchema.index({ 'location.coordinates': '2dsphere' });
crimeReportSchema.index({ createdAt: -1 });
crimeReportSchema.index({ crimeType: 1, createdAt: -1 });

export const CrimeReport = mongoose.model('CrimeReport', crimeReportSchema);
