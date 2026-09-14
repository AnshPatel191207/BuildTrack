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

  // Clean up legacy/orphan indexes that conflict with bookings
  try {
    const bookingCol = mongoose.connection.collection('bookings');
    const indexes = await bookingCol.indexes();
    for (const idx of indexes) {
      if (idx.name && (idx.name === 'bookingNo_1' || idx.name === 'bookingId_1' || (idx.key && ((idx.key as any).bookingNo || (idx.key as any).bookingId)))) {
        await bookingCol.dropIndex(idx.name);
        console.log(`Successfully dropped legacy ${idx.name} index from bookings collection.`);
      }
    }
  } catch {
    // ignore if collection does not exist yet
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}
