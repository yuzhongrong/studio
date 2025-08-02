// src/instrumentation.ts
import { config } from 'dotenv';
import { startPolling } from '@/lib/polling-service';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Load environment variables from .env file before starting any services
    config(); 
    console.log("Starting background polling service from instrumentation...");
    startPolling();
  }
}
