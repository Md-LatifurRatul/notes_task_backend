import { Router } from 'express';
import { z } from 'zod';
import { Post } from '../models/post.model.js';
import { asyncHandler } from '../utils/async-handler.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    Post.find({}).select('_id author title body createdAt').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Post.countDocuments({})
  ]);
  res.json({ data: items, pagination: paginationMeta(total, page, limit) });
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const input = z.object({ title: z.string().trim().min(1).max(160), body: z.string().min(1).max(20_000) }).parse(req.body);
  const post = await Post.create({ ...input, author: req.user._id });
  res.status(201).json({ data: post });
}));

export default router;
