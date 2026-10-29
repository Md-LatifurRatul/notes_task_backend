import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';

if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before seeding the administrator');
if (env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must meet the API password policy of at least 12 characters');

try {
  await connectDatabase();
  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw new Error('An account with ADMIN_EMAIL already exists; no changes made');
  await User.create({ email, password: env.ADMIN_PASSWORD, role: 'admin' });
  console.info(`Administrator created for ${email}`);
} finally {
  await mongoose.disconnect();
}
