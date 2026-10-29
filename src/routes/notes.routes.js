import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Note } from '../models/note.model.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
const noteInput = z.object({ title: z.string().trim().min(1).max(160), content: z.string().max(100_000) });
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    Note.find({ owner: req.user._id }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Note.countDocuments({ owner: req.user._id })
  ]);
  res.json({ data: items, pagination: paginationMeta(total, page, limit) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const input = noteInput.parse(req.body);
  const note = await Note.create({ ...input, owner: req.user._id });
  res.status(201).json({ data: note });
}));

router.get('/admin/all', requireAdmin, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    Note.find({}).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Note.countDocuments({})
  ]);
  res.json({ data: items, pagination: paginationMeta(total, page, limit) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid note id');
  const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, owner: req.user._id };
  const note = await Note.findOne(filter).lean();
  if (!note) throw new HttpError(404, 'Note not found');
  res.json({ data: note });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid note id');
  const input = noteInput.partial().strict().parse(req.body);
  if (Object.keys(input).length === 0) throw new HttpError(400, 'Provide at least one field to update');
  const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, owner: req.user._id };
  const note = await Note.findOneAndUpdate(filter, { $set: { ...input, updatedAt: new Date() } }, { new: true, runValidators: true }).lean();
  if (!note) throw new HttpError(404, 'Note not found');
  res.json({ data: note });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid note id');
  const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, owner: req.user._id };
  const note = await Note.findOneAndDelete(filter);
  if (!note) throw new HttpError(404, 'Note not found');
  res.status(204).end();
}));

export default router;
