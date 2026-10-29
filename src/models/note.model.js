import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
  content: { type: String, required: true, maxlength: 100_000 },
  createdAt: { type: Date, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

noteSchema.index({ owner: 1, createdAt: -1, _id: -1 }, { name: 'notes_owner_created_at' });
noteSchema.index({ createdAt: -1, _id: -1 }, { name: 'notes_created_at' });

noteSchema.pre('save', function setUpdatedAt() {
  this.updatedAt = new Date();
});

export const Note = mongoose.model('Note', noteSchema);
