// This is a server-side only module
import { fetchApiData, updateRsiData } from '@/app/actions';

const DEXSCREENER_POLLING_INTERVAL_MS = 60000; // 1 minute
const RSI_POLLING_INTERVAL_MS = 30000; // 30 seconds
const API_ENDPOINT = "https://dexscreen-scraper-delta.vercel.app/dex?generated_text=%26filters%5BmarketCap%5D%5Bmin%5D%3D2000000%26filters%5BchainIds%5D%5B0%5D%3Dsolana";

let isPolling = false;
let isStarted = false; 

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Task 1: Periodically fetches data from the dexscreener endpoint and saves it.
 */
async function pollDexscreenerData() {
  console.log('Starting Dexscreener data polling loop.');
  while (isPolling) {
    try {
      console.log('Polling for new dexscreener data...');
      const apiResult = await fetchApiData(API_ENDPOINT);
      
      if (apiResult.error) {
        console.error('Dexscreener polling error:', apiResult.error);
      } else {
        console.log('Dexscreener polling success:', apiResult.successMessage);
      }
    } catch (error) {
      console.error('An unexpected error occurred during the dexscreener polling loop:', error);
    }
    await sleep(DEXSCREENER_POLLING_INTERVAL_MS);
  }
}

/**
 * Task 2: Periodically fetches candle data from OKX and updates RSI values in the database.
 */
async function pollRsiData() {
    console.log('Starting RSI data polling loop.');
    while(isPolling) {
        try {
            console.log('Triggering RSI data update from OKX...');
            const rsiResult = await updateRsiData();
            
            if (rsiResult.error) {
                console.error('RSI update process finished with an error:', rsiResult.error);
            } else {
                console.log('RSI update process finished successfully.', rsiResult.message);
            }
        } catch (error) {
            console.error('An unexpected error occurred during the RSI polling loop:', error);
        }
        await sleep(RSI_POLLING_INTERVAL_MS);
    }
}


export function startPolling() {
  if (isStarted) {
    return;
  }
  isStarted = true;
  isPolling = true;

  console.log('Background polling services started.');

  // Start both polling loops to run in parallel
  pollDexscreenerData();
  pollRsiData();
}

export function stopPolling() {
  if (isPolling) {
    isPolling = false;
    console.log('Background polling services stopped.');
  }
}
