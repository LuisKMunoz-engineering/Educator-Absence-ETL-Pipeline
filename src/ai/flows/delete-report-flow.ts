'use server';
/**
 * @fileOverview A flow to delete a specific report file.
 *
 * - deleteReport - Removes a report file from the storage.
 * - DeleteReportInput - The input type for the deleteReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';

const DeleteReportInputSchema = z.object({
    fileName: z.string().refine(name => /^[a-zA-Z0-9_.-]+\.xlsx$/.test(name), {
        message: "Nombre de archivo inválido."
    }),
});

export type DeleteReportInput = z.infer<typeof DeleteReportInputSchema>;

const DeleteReportOutputSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

export async function deleteReport(input: DeleteReportInput) {
    return deleteReportFlow(input);
}

const deleteReportFlow = ai.defineFlow(
    {
        name: 'deleteReportFlow',
        inputSchema: DeleteReportInputSchema,
        outputSchema: DeleteReportOutputSchema,
    },
    async (input) => {
        try {
            // Validate that the filename doesn't contain path traversal characters
            if (input.fileName.includes('..')) {
                throw new Error("Acceso no permitido.");
            }

            const filePath = path.join(process.cwd(), 'storage', 'reports', input.fileName);
            
            // Check if file exists before trying to delete
            await fs.access(filePath);
            await fs.unlink(filePath);

            return {
                success: true,
            };

        } catch (error: any) {
            console.error("Error in deleteReportFlow:", error);
            if (error.code === 'ENOENT') {
                return { success: false, error: 'El archivo solicitado no existe.' };
            }
            return { success: false, error: error.message || 'Ocurrió un error al eliminar el reporte.' };
        }
    }
);
