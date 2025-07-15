// This is a server-side only module
import { fetchApiData, updateRsiData } from '@/app/actions';

const POLLING_INTERVAL_MS = 60000; // 1 minute
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
      console.log('Polling for new dexscreener data...');
      const apiResult = await fetchApiData(API_ENDPOINT);
      
      if (apiResult.error) {
        console.error('Dexscreener polling error:', apiResult.error);
      } else {
        console.log('Dexscreener polling success:', apiResult.successMessage);
      }

      // Trigger the RSI data update independently.
      console.log('Triggering RSI data update from OKX...');
      const rsiResult = await updateRsiData();
      
      if (rsiResult.error) {
        console.error('RSI update process finished with an error:', rsiResult.error);
      } else {
        console.log('RSI update process finished successfully.', rsiResult.message);
      }

    } catch (error) {
      console.error('An unexpected error occurred during the main polling loop:', error);
    }
    
    console.log(`Polling cycle finished. Waiting for ${POLLING_INTERVAL_MS / 1000} seconds...`);
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
