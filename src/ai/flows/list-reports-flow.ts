
'use server';
/**
 * @fileOverview A flow to list report files from Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { storage } from '@/lib/firebase-admin';

const ListReportsOutputSchema = z.object({
    success: z.boolean(),
    reports: z.array(z.string()).optional(),
    error: z.string().optional(),
});

export async function listReports(): Promise<z.infer<typeof ListReportsOutputSchema>> {
    return listReportsFlow();
}

const listReportsFlow = ai.defineFlow(
    { name: 'listReportsFlow', outputSchema: ListReportsOutputSchema },
    async () => {
        try {
            const [files] = await storage.bucket().getFiles({ prefix: 'reports/' });
            const reportNames = files
                .map(file => file.name.replace('reports/', ''))
                .filter(name => name.endsWith('.xlsx'))
                .sort((a, b) => b.localeCompare(a));

            return { success: true, reports: reportNames };
        } catch (error: any) {
            console.error("Error listing reports from Storage:", error);
            return { success: false, error: error.message };
        }
    }
);
