import mongoose from 'mongoose';
import { env } from './env';

let connected = false;

export async function connectDatabase(): Promise<void> {
  if (connected) return;
  const uri = process.env.MONGODB_URI || env.MONGODB_URI;
  await mongoose.connect(uri, {
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
