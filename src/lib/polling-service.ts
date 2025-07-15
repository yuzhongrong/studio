// This is a server-side only module
import { fetchApiData } from '@/app/actions';

const POLLING_INTERVAL_MS = 15000; // 15 seconds
const API_ENDPOINT = "https://dexscreen-scraper-delta.vercel.app/dex?generated_text=%26filters%5BmarketCap%5D%5Bmin%5D%3D2000000%26filters%5BchainIds%5D%5B0%5D%3Dsolana";

let isPolling = false;

// A simple in-memory lock to ensure the polling starts only once.
let isStarted = false; 

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function poll() {
  isPolling = true;
  console.log('Background polling service started.');

  while (isPolling) {
    try {
      console.log('Polling for new data...');
      const result = await fetchApiData(API_ENDPOINT);
      if (result.error) {
        console.error('Polling error:', result.error);
      }
      if (result.successMessage) {
        console.log('Polling success:', result.successMessage);
      }
    } catch (error) {
      console.error('An unexpected error occurred during polling:', error);
    }
    await sleep(POLLING_INTERVAL_MS);
  }

  console.log('Background polling service stopped.');
}

export function startPolling() {
  if (isStarted) {
    return;
  }
  isStarted = true;
  poll();
}

export function stopPolling() {
  isPolling = false;
}
