
'use server';
/**
 * @fileOverview A flow to delete a report from Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { storage } from '@/lib/firebase-admin';

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
            await storage.bucket().file(`reports/${input.fileName}`).delete();
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
);
