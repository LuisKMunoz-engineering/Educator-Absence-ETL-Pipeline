
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
        try {
            const reportsDir = path.join(process.cwd(), 'storage', 'reports');
            await fs.mkdir(reportsDir, { recursive: true });
            
            const filePath = path.join(reportsDir, `Ausentismo_${input.month}.xlsx`);
            const fileBuffer = await fs.readFile(filePath);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const existingData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
            
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

            const sheet = XLSX.utils.json_to_sheet(updatedData);
            workbook.Sheets[workbook.SheetNames[0]] = sheet;
            
            const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            await fs.writeFile(filePath, buf);
            
            return { success: true };
        } catch (error: any) {
            console.error("Error rejecting report:", error);
            return { success: false, error: "No se pudo guardar el rechazo en el archivo. Verifique permisos del servidor." };
        }
    }
);
