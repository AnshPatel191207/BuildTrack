import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { createApp } from './app';
import { logInfo, logError } from './utils/logger';
import { runNotificationScan } from './services/notificationEngine';

async function main() {
  try {
    await connectDatabase();
    logInfo(`✅ MongoDB connected`);

    const app = createApp();
    const server = app.listen(env.PORT, () => {
      logInfo(`🚧 BuildTrack API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    });

    // Module 23 — periodic ERP notification engine (every 30 minutes).
    const NOTIFICATION_SCAN_MS = 30 * 60 * 1000;
    const scanTimer = setInterval(
      () => void runNotificationScan(),
      NOTIFICATION_SCAN_MS,
    );
    scanTimer.unref?.();
    setTimeout(() => void runNotificationScan(), 15_000).unref?.();

    const shutdown = async (signal: string) => {
      logInfo(`\n${signal} received — shutting down gracefully…`);
      clearInterval(scanTimer);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (err) {
    logError('Fatal startup error', err);
    logError('Hint: is MongoDB running and is MONGODB_URI correct?');
    process.exit(1);
  }
}

void main();
