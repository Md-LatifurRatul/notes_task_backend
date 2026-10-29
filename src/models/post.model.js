import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
  body: { type: String, required: true, maxlength: 20_000 },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });

// Supports the $lookup equality join and per-author post list ordering.
postSchema.index({ author: 1, createdAt: -1, _id: -1 }, { name: 'posts_author_created_at' });
postSchema.index({ createdAt: -1, _id: -1 }, { name: 'posts_created_at' });

export const Post = mongoose.model('Post', postSchema);
