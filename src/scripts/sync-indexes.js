import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { User } from '../models/user.model.js';
import { Note } from '../models/note.model.js';
import { Post } from '../models/post.model.js';

// Production disables autoIndex, so schema.index() declarations are applied explicitly.
// createIndexes() only creates the declared indexes; it never drops anything.
try {
  await connectDatabase();
  const collections = [
    ['users', User],
    ['notes', Note],
    ['posts', Post]
  ];
  for (const [name, model] of collections) {
    await model.createIndexes();
    const indexes = (await model.collection.indexes()).map((index) => index.name).join(', ');
    console.info(`${name}: ${indexes}`);
  }
} finally {
  await mongoose.disconnect();
}
