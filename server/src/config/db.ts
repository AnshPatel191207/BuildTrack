import mongoose from 'mongoose';
import { env } from './env';

let connected = false;

export async function connectDatabase(): Promise<void> {
  if (connected) return;
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: !env.isProd,
    serverSelectionTimeoutMS: 10_000,
  });
  connected = true;
}

export async function disconnectDatabase(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}
