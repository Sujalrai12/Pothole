import mongoose from 'mongoose'

const reportSchema = new mongoose.Schema({
  reference: { type: String, unique: true, index: true },
  neighborhood: { type: String, required: true, trim: true, maxlength: 100 },
  wardNumber: { type: String, default: '', trim: true, maxlength: 20 },
  road: { type: String, required: true, trim: true, maxlength: 180 },
  zone: { type: String, default: '', trim: true, maxlength: 100 },
  description: { type: String, default: '', trim: true, maxlength: 1200 },
  image: { type: String, default: 'pothole-one' },
  imageUrl: { type: String, default: '' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: { type: [Number], required: true, validate: (coordinates) => coordinates.length === 2 },
  },
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  severity: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['Reported', 'In progress', 'Fixed'], default: 'Reported' },
  statusHistory: [{ status: { type: String, enum: ['Reported', 'In progress', 'Fixed'] }, changedAt: { type: Date, default: Date.now }, note: { type: String, default: '' } }],
}, { timestamps: true })

reportSchema.index({ location: '2dsphere' })
reportSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('Report', reportSchema)
