// src/ai/flows/redact-sensitive-data.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for redacting sensitive data from Excel files.
 *
 * - redactSensitiveData -  A function that handles the redaction of sensitive data in Excel files.
 * - RedactSensitiveDataInput - The input type for the redactSensitiveData function.
 * - RedactSensitiveDataOutput - The return type for the redactSensitiveData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RedactSensitiveDataInputSchema = z.object({
  excelDataUri: z
    .string()
    .describe(
      "The Excel file to scan for sensitive data, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type RedactSensitiveDataInput = z.infer<typeof RedactSensitiveDataInputSchema>;

const RedactSensitiveDataOutputSchema = z.object({
  sensitiveDataFound: z
    .boolean()
    .describe('Whether or not sensitive data was found in the Excel file.'),
  redactionSuggestions: z
    .array(z.string())
    .describe(
      'Suggestions for redacting the sensitive data, if any was found.'
    ),
  message: z
    .string()
    .describe(
      'A message to the user indicating whether sensitive data was found and, if so, providing instructions for redacting it.'
    ),
});
export type RedactSensitiveDataOutput = z.infer<typeof RedactSensitiveDataOutputSchema>;

export async function redactSensitiveData(
  input: RedactSensitiveDataInput
): Promise<RedactSensitiveDataOutput> {
  return redactSensitiveDataFlow(input);
}

const redactSensitiveDataPrompt = ai.definePrompt({
  name: 'redactSensitiveDataPrompt',
  input: {schema: RedactSensitiveDataInputSchema},
  output: {schema: RedactSensitiveDataOutputSchema},
  prompt: `You are an AI assistant that helps users redact sensitive information from Excel files.

You will receive an Excel file as a data URI. Your task is to analyze the file and determine if it contains any sensitive personal information, such as document IDs or social security numbers. 

If sensitive information is found, provide specific suggestions for redacting it. If no sensitive information is found, inform the user that they can proceed confidently.

Excel File: {{media url=excelDataUri}}
`,
});

const redactSensitiveDataFlow = ai.defineFlow(
  {
    name: 'redactSensitiveDataFlow',
    inputSchema: RedactSensitiveDataInputSchema,
    outputSchema: RedactSensitiveDataOutputSchema,
  },
  async input => {
    const {output} = await redactSensitiveDataPrompt(input);
    return output!;
  }
);
