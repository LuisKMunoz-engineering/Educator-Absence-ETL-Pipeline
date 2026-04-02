'use server';
/**
 * @fileOverview A flow to list all available absenteeism report files.
 * 
 * - listReports - Fetches a list of all generated .xlsx report files.
 * - ListReportsOutput - The return type for the listReports function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';

const ListReportsOutputSchema = z.object({
    success: z.boolean(),
    reports: z.array(z.string()).optional(),
    error: z.string().optional(),
});
export type ListReportsOutput = z.infer<typeof ListReportsOutputSchema>;

const REPORTS_DIR = path.join(process.cwd(), 'storage', 'reports');

// Helper function to ensure the directory exists.
async function ensureDirectoryExists(dirPath: string) {
    try {
        await fs.access(dirPath);
    } catch (error) {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

// Main exported function that the client will call.
export async function listReports(): Promise<ListReportsOutput> {
    return listReportsFlow();
}

const listReportsFlow = ai.defineFlow(
    {
        name: 'listReportsFlow',
        outputSchema: ListReportsOutputSchema,
    },
    async () => {
        try {
            await ensureDirectoryExists(REPORTS_DIR);

            const allFiles = await fs.readdir(REPORTS_DIR);
            
            // Filter for .xlsx files and sort them
            const reportFiles = allFiles
                .filter(file => file.endsWith('.xlsx'))
                .sort((a, b) => {
                    // Extract YYYY-MM from filenames like 'Ausentismo_YYYY-MM.xlsx'
                    const a_match = a.match(/_(\d{4}-\d{2})\.xlsx$/);
                    const b_match = b.match(/_(\d{4}-\d{2})\.xlsx$/);
                    
                    const dateA = a_match ? new Date(a_match[1]) : new Date(0);
                    const dateB = b_match ? new Date(b_match[1]) : new Date(0);

                    // Sort descending to show newest first
                    return dateB.getTime() - dateA.getTime();
                });

            return { success: true, reports: reportFiles };

        } catch (error: any) {
            console.error("Error in listReportsFlow:", error);
            return { success: false, error: error.message || 'Ocurrió un error al listar los reportes.' };
        }
    }
);
