'use server';
/**
 * @fileOverview A flow to mark reports as verified locally.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

const VerifyReportsInputSchema = z.object({
    month: z.string(),
    verifiedDaneCodes: z.array(z.string()),
});

export async function verifyReports(input: z.infer<typeof VerifyReportsInputSchema>) {
    return verifyReportsFlow(input);
}

const verifyReportsFlow = ai.defineFlow(
    { name: 'verifyReportsFlow', inputSchema: VerifyReportsInputSchema, outputSchema: z.any() },
    async (input) => {
        const filePath = path.join(process.cwd(), 'storage', 'reports', `Ausentismo_${input.month}.xlsx`);
        const fileBuffer = await fs.readFile(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const existingData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
        
        const now = new Date();
        const verifiedSet = new Set(input.verifiedDaneCodes);

        const updatedData = existingData.map(row => {
            if (verifiedSet.has(String(row['DANE ESTABLECIMIENTO EDUCATIVO']))) {
                return { ...row, 'Verificado': now, 'Estado del Reporte': 'Verificado' };
            }
            return row;
        });

        const sheet = XLSX.utils.json_to_sheet(updatedData, { cellDates: true });
        workbook.Sheets[workbook.SheetNames[0]] = sheet;
        XLSX.writeFile(workbook, filePath);
        return { success: true };
    }
);
