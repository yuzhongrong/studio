import {genkit, noopTraceStore} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
  traceStore: noopTraceStore, // Use in-memory trace store to avoid default mongo connection
});
