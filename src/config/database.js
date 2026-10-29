import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('autoIndex', env.NODE_ENV !== 'production');
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== 'production',
    serverSelectionTimeoutMS: 10_000
  });
  return mongoose.connection;
}
