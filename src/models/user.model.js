import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true, select: false, minlength: 12, validate: { validator: (value) => Buffer.byteLength(value, 'utf8') <= 72, message: 'Password must be at most 72 UTF-8 bytes' } },
  role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
  interests: { type: [String], default: [], validate: (values) => values.length <= 50 },
  createdAt: { type: Date, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false, timestamps: false, toJSON: { transform: (_doc, ret) => { delete ret.password; return ret; } } });

// Login lookup (and duplicate-email prevention) on the normalized email.
userSchema.index({ email: 1 }, { unique: true, name: 'user_email_unique' });
// Admin user listing: skip/limit sort on { createdAt: -1, _id: -1 }. The built-in _id index cannot
// satisfy a createdAt sort, so this compound index is strictly required by that list view.
userSchema.index({ createdAt: -1, _id: -1 }, { name: 'users_created_at' });

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
  this.updatedAt = new Date();
});

userSchema.methods.verifyPassword = function verifyPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
