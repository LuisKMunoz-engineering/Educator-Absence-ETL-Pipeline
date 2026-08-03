'use server';
/**
 * @fileOverview A flow to mark reports as rejected with unified date formatting.
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
    const result = await rejectReportFlow(input);
    return JSON.parse(JSON.stringify(result));
}

const rejectReportFlow = ai.defineFlow(
    { name: 'rejectReportFlow', inputSchema: RejectReportInputSchema, outputSchema: z.any() },
    async (input) => {
        try {
            const reportsDir = path.join(process.cwd(), 'storage', 'reports');
            const filePath = path.join(reportsDir, `Ausentismo_${input.month}.xlsx`);
            const fileBuffer = await fs.readFile(filePath);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const existingData: any[] = XLSX.utils.sheet_to_json(sheet, { raw: true });
            
            const updatedData = existingData.map(row => {
                if (String(row['DANE ESTABLECIMIENTO EDUCATIVO']) === input.daneCode) {
                    return { 
                        ...row, 
                        'Estado del Reporte': 'Rechazado para corrección', 
                        'Observación del Director': input.observation, 
                        'Verificado': undefined 
                    };
                }
                return row;
            });

            const newSheet = XLSX.utils.json_to_sheet(updatedData, { cellDates: true });
            
            // Reinforce date formatting
            const range = XLSX.utils.decode_range(newSheet['!ref'] || 'A1');
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell = newSheet[XLSX.utils.encode_cell({ r: R, c: C })];
                    if (cell && cell.t === 'd') {
                        cell.z = 'dd/mm/yyyy';
                    }
                }
            }

            workbook.Sheets[workbook.SheetNames[0]] = newSheet;
            const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            await fs.writeFile(filePath, buf);
            
            return { success: true };
        } catch (error: any) {
            console.error("Error rejecting report:", error);
            return { success: false, error: error.message };
        }
    }
);