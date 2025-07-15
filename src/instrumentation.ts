// src/instrumentation.ts
import { startPolling } from '@/lib/polling-service';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log("Starting background polling service from instrumentation...");
    startPolling();
  }
}
