'use server';

/**
 * @fileOverview Provides filter suggestions based on a description of the desired data.
 *
 * - suggestFilters - a function that takes a data description and suggests filter expressions.
 * - SuggestFiltersInput - The input type for the suggestFilters function.
 * - SuggestFiltersOutput - The return type for the suggestFilters function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestFiltersInputSchema = z.object({
  rawJson: z.string().describe('The raw JSON data to filter.'),
  dataDescription: z
    .string()
    .describe('A description of the data the user is seeking.'),
});
export type SuggestFiltersInput = z.infer<typeof SuggestFiltersInputSchema>;

const SuggestFiltersOutputSchema = z.object({
  filterExpressions: z
    .array(z.string())
    .describe('An array of filter expressions to apply to the JSON data.'),
});
export type SuggestFiltersOutput = z.infer<typeof SuggestFiltersOutputSchema>;

export async function suggestFilters(input: SuggestFiltersInput): Promise<SuggestFiltersOutput> {
  return suggestFiltersFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestFiltersPrompt',
  input: {schema: SuggestFiltersInputSchema},
  output: {schema: SuggestFiltersOutputSchema},
  prompt: `You are an AI assistant helping users filter JSON data based on their descriptions.

  The user will provide raw JSON data and a description of the data they are seeking.
  Your task is to generate an array of filter expressions that can be applied to the JSON data to retrieve the relevant information.

  Here's the raw JSON data:
  \`\`\`json
  {{{rawJson}}}
  \`\`\`

  Here's the description of the data the user is seeking:
  {{{dataDescription}}}

  Provide an array of filter expressions:
  `,
});

const suggestFiltersFlow = ai.defineFlow(
  {
    name: 'suggestFiltersFlow',
    inputSchema: SuggestFiltersInputSchema,
    outputSchema: SuggestFiltersOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
