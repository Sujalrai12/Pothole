import mongoose from 'mongoose'

const staffMemberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  role: { type: String, enum: ['Administrator', 'Municipal Officer', 'Field Engineer'], default: 'Field Engineer' },
  zone: { type: String, default: 'Unassigned', trim: true, maxlength: 100 },
  status: { type: String, enum: ['Active', 'Pending'], default: 'Pending' },
}, { timestamps: true })

export default mongoose.model('StaffMember', staffMemberSchema)
