// src/instrumentation.ts
import { config } from 'dotenv';
import { startPolling } from '@/lib/polling-service';
import { createTtlIndex } from '@/lib/mongodb';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Load environment variables from .env file before starting any services
    config({ path: './.env' }); 
    await createTtlIndex();
    console.log("Starting background polling service from instrumentation...");
    startPolling();
  }
}
