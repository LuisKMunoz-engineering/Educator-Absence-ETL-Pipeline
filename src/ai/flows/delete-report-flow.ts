
'use server';
/**
 * @fileOverview A flow to delete a report from the local storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

const DeleteReportInputSchema = z.object({
    fileName: z.string(),
});

export async function deleteReport(input: z.infer<typeof DeleteReportInputSchema>) {
    return deleteReportFlow(input);
}

const deleteReportFlow = ai.defineFlow(
    { name: 'deleteReportFlow', inputSchema: DeleteReportInputSchema, outputSchema: z.object({ success: z.boolean(), error: z.string().optional() }) },
    async (input) => {
        try {
            const filePath = path.join(process.cwd(), 'storage', 'reports', input.fileName);
            await fs.unlink(filePath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
);
