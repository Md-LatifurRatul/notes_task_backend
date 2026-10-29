import mongoose from 'mongoose';
import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

await connectDatabase();
const server = app.listen(env.PORT, () => console.info(`API listening on port ${env.PORT}`));

async function shutdown(signal) {
  console.info(`${signal}: shutting down`);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
