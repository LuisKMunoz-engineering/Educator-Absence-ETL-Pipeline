'use server';
/**
 * @fileOverview A flow to download a specific report file.
 *
 * - downloadReport - Fetches a report file and returns it as a Base64 string.
 * - DownloadReportInput - The input type for the downloadReport function.
 * - DownloadReportOutput - The return type for the downloadReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ZodError } from 'zod';

const DownloadReportInputSchema = z.object({
    fileName: z.string().refine(name => /^[a-zA-Z0-9_.-]+\.xlsx$/.test(name), {
        message: "Nombre de archivo inválido."
    }),
});
export type DownloadReportInput = z.infer<typeof DownloadReportInputSchema>;

const DownloadReportOutputSchema = z.object({
    success: z.boolean(),
    fileContent: z.string().optional(), // Base64 encoded file content
    fileName: z.string().optional(),
    error: z.string().optional(),
});
export type DownloadReportOutput = z.infer<typeof DownloadReportOutputSchema>;

const REPORTS_DIR = path.join(process.cwd(), 'storage', 'reports');

// Main exported function that the client will call.
export async function downloadReport(input: DownloadReportInput): Promise<DownloadReportOutput> {
    return downloadReportFlow(input);
}

const downloadReportFlow = ai.defineFlow(
    {
        name: 'downloadReportFlow',
        inputSchema: DownloadReportInputSchema,
        outputSchema: DownloadReportOutputSchema,
    },
    async (input) => {
        try {
            // Validate that the filename doesn't contain path traversal characters
            if (input.fileName.includes('..')) {
                throw new Error("Acceso no permitido.");
            }

            const filePath = path.join(REPORTS_DIR, input.fileName);
            
            // Check if file exists
            await fs.access(filePath);

            const fileBuffer = await fs.readFile(filePath);
            const base64Content = fileBuffer.toString('base64');

            return {
                success: true,
                fileContent: base64Content,
                fileName: input.fileName,
            };

        } catch (error: any) {
             if (error instanceof ZodError) {
                return { success: false, error: 'Error de validación: ' + error.errors.map(e => e.message).join(', ') };
            }
            console.error("Error in downloadReportFlow:", error);
            if (error.code === 'ENOENT') {
                return { success: false, error: 'El archivo solicitado no existe.' };
            }
            return { success: false, error: error.message || 'Ocurrió un error al descargar el reporte.' };
        }
    }
);
