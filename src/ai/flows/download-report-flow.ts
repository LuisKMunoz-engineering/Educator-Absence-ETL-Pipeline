
'use server';
/**
 * @fileOverview A flow to download a report from the local storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

const DownloadReportInputSchema = z.object({
    fileName: z.string(),
});

const DownloadReportOutputSchema = z.object({
    success: z.boolean(),
    fileContent: z.string().optional(),
    fileName: z.string().optional(),
    error: z.string().optional(),
});

export async function downloadReport(input: z.infer<typeof DownloadReportInputSchema>): Promise<z.infer<typeof DownloadReportOutputSchema>> {
    return downloadReportFlow(input);
}

const downloadReportFlow = ai.defineFlow(
    { name: 'downloadReportFlow', inputSchema: DownloadReportInputSchema, outputSchema: DownloadReportOutputSchema },
    async (input) => {
        try {
            const filePath = path.join(process.cwd(), 'storage', 'reports', input.fileName);
            const fileBuffer = await fs.readFile(filePath);
            
            return {
                success: true,
                fileContent: fileBuffer.toString('base64'),
                fileName: input.fileName,
            };
        } catch (error: any) {
            return { success: false, error: "El archivo no se pudo encontrar en el servidor local." };
        }
    }
);
