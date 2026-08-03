'use server';
/**
 * @fileOverview A flow to mark reports as rejected locally.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

const RejectReportInputSchema = z.object({
    month: z.string(),
    daneCode: z.string(),
    observation: z.string(),
});

export async function rejectReport(input: z.infer<typeof RejectReportInputSchema>) {
    return rejectReportFlow(input);
}

const rejectReportFlow = ai.defineFlow(
    { name: 'rejectReportFlow', inputSchema: RejectReportInputSchema, outputSchema: z.any() },
    async (input) => {
        const filePath = path.join(process.cwd(), 'storage', 'reports', `Ausentismo_${input.month}.xlsx`);
        const fileBuffer = await fs.readFile(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const existingData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
        
        const updatedData = existingData.map(row => {
            if (String(row['DANE ESTABLECIMIENTO EDUCATIVO']) === input.daneCode) {
                return { ...row, 'Estado del Reporte': 'Rechazado para corrección', 'Observación del Director': input.observation, 'Verificado': undefined };
            }
            return row;
        });

        const sheet = XLSX.utils.json_to_sheet(updatedData, { cellDates: true });
        workbook.Sheets[workbook.SheetNames[0]] = sheet;
        XLSX.writeFile(workbook, filePath);
        return { success: true };
    }
);
