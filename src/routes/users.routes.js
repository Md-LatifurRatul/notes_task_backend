import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/user.model.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
const passwordSchema = z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes');
const profileInput = z.object({ email: z.string().email().max(254), password: passwordSchema, role: z.enum(['user', 'admin']).optional(), interests: z.array(z.string().trim().min(1).max(40)).max(50).optional() });
const updateInput = z.object({ email: z.string().email().max(254).optional(), password: passwordSchema.optional(), role: z.enum(['user', 'admin']).optional(), interests: z.array(z.string().trim().min(1).max(40)).max(50).optional() }).strict();

router.use(requireAuth);

// Grouping the whole user directory is an admin listing capability.
router.get('/groups/interests', requireAdmin, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const pipeline = [
    { $match: { interests: { $exists: true, $type: 'array' } } },
    { $unwind: '$interests' },
    { $group: { _id: '$interests', users: { $push: { _id: '$_id', email: '$email', role: '$role' } }, userCount: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $facet: { data: [{ $skip: skip }, { $limit: limit }], metadata: [{ $count: 'total' }] } },
    { $project: { data: 1, total: { $ifNull: [{ $arrayElemAt: ['$metadata.total', 0] }, 0] } } }
  ];
  // Exactly one collection.aggregate() call; pagination and count are both in this pipeline.
  const [result = { data: [], total: 0 }] = await User.aggregate(pipeline);
  res.json({ data: result.data, pagination: paginationMeta(result.total, page, limit) });
}));

// Posts are visible to every signed-in user, so this aggregation is not admin-gated.
router.get('/:id/posts', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid user id');
  const { page, limit, skip } = parsePagination(req.query);
  const pipeline = [
    { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
    { $lookup: {
      from: 'posts', localField: '_id', foreignField: 'author',
      pipeline: [
        { $sort: { createdAt: -1, _id: -1 } },
        { $facet: { data: [{ $skip: skip }, { $limit: limit }], metadata: [{ $count: 'total' }] } },
        { $project: { data: 1, total: { $ifNull: [{ $arrayElemAt: ['$metadata.total', 0] }, 0] } } }
      ],
      as: 'postResult'
    } },
    { $project: { _id: 1, posts: { $ifNull: [{ $arrayElemAt: ['$postResult.data', 0] }, []] }, total: { $ifNull: [{ $arrayElemAt: ['$postResult.total', 0] }, 0] } } }
  ];
  const [result] = await User.aggregate(pipeline);
  if (!result) throw new HttpError(404, 'User not found');
  res.json({ data: result.posts, pagination: paginationMeta(result.total, page, limit) });
}));

router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    User.find({}).select('_id email role interests createdAt updatedAt').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments({})
  ]);
  res.json({ data: items, pagination: paginationMeta(total, page, limit) });
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const input = profileInput.parse(req.body);
  const user = await User.create(input);
  res.status(201).json({ data: user.toJSON() });
}));

router.get('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('_id email role interests createdAt updatedAt').lean();
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ data: user });
}));

router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const input = updateInput.parse(req.body);
  if (Object.keys(input).length === 0) throw new HttpError(400, 'Provide at least one field to update');
  if (req.user._id.toString() === req.params.id && input.role === 'user') throw new HttpError(400, 'You cannot remove your own administrator role');
  const user = await User.findById(req.params.id).select('+password');
  if (!user) throw new HttpError(404, 'User not found');
  Object.assign(user, input);
  await user.save();
  res.json({ data: user.toJSON() });
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  if (req.user._id.toString() === req.params.id) throw new HttpError(400, 'You cannot delete your own account');
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  await user.deleteOne();
  res.status(204).end();
}));

export default router;
