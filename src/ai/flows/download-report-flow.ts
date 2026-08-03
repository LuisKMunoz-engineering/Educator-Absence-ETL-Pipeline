
'use server';
/**
 * @fileOverview A flow to download a report from Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { storage } from '@/lib/firebase-admin';

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
            const bucket = storage.bucket();
            const file = bucket.file(`reports/${input.fileName}`);
            
            const [exists] = await file.exists();
            if (!exists) throw new Error("El archivo no existe en la nube.");

            const [fileBuffer] = await file.download();
            return {
                success: true,
                fileContent: fileBuffer.toString('base64'),
                fileName: input.fileName,
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
);
