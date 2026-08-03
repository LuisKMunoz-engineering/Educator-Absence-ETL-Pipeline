'use server';
/**
 * @fileOverview A flow to mark absenteeism reports as verified using Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as XLSX from 'xlsx';
import { storage } from '@/lib/firebase-admin';

const parseDateValue = (value?: string | Date): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value !== 'string' || value.trim() === '') return undefined;

    const dateTimeParts = value.split(' ');
    const dateParts = dateTimeParts[0].split('/');
    
    if (dateParts.length === 3) {
        const [day, month, year] = dateParts.map(p => parseInt(p, 10));
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            const fullYear = year < 100 ? 2000 + year : year;
            const date = new Date(fullYear, month - 1, day);
            if (dateTimeParts.length > 1) {
                const timeParts = dateTimeParts[1].split(':');
                if (timeParts.length >= 2) {
                   date.setHours(parseInt(timeParts[0], 10));
                   date.setMinutes(parseInt(timeParts[1], 10));
                   if (timeParts.length > 2) date.setSeconds(parseInt(timeParts[2], 10));
                }
            }
            if (!isNaN(date.getTime())) return date;
        }
    }
    const fallbackDate = new Date(value);
    return isNaN(fallbackDate.getTime()) ? undefined : fallbackDate;
};

const VerifyReportsInputSchema = z.object({
    month: z.string(),
    verifiedDaneCodes: z.array(z.string()),
});
export type VerifyReportsInput = z.infer<typeof VerifyReportsInputSchema>;

const VerifyReportsOutputSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});
export type VerifyReportsOutput = z.infer<typeof VerifyReportsOutputSchema>;

export async function verifyReports(input: VerifyReportsInput): Promise<VerifyReportsOutput> {
    return verifyReportsFlow(input);
}

const verifyReportsFlow = ai.defineFlow(
    {
        name: 'verifyReportsFlow',
        inputSchema: VerifyReportsInputSchema,
        outputSchema: VerifyReportsOutputSchema,
    },
    async (input) => {
        try {
            if (input.verifiedDaneCodes.length === 0) return { success: true };

            const fileName = `reports/Ausentismo_${input.month}.xlsx`;
            const bucket = storage.bucket();
            const file = bucket.file(fileName);
            
            let workbook: XLSX.WorkBook;
            let existingData: any[] = [];
            
            const [exists] = await file.exists();
            if (!exists) return { success: false, error: "No se encontró el archivo de reporte para el mes seleccionado." };

            const [fileBuffer] = await file.download();
            workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            if (sheetName) {
                existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });
            } else {
                throw new Error("El archivo de reporte está vacío.");
            }
            
            const verificationDate = new Date();
            const verifiedDaneSet = new Set(input.verifiedDaneCodes);

            const updatedData = existingData.map(row => {
                const rowDane = String(row['DANE ESTABLECIMIENTO EDUCATIVO']);
                const parsedRow = {
                    ...row,
                    'Fecha Inicio': parseDateValue(row['Fecha Inicio']),
                    'Fecha Final': parseDateValue(row['Fecha Final']),
                    'Fecha Ausencia menos de un día': parseDateValue(row['Fecha Ausencia menos de un día']),
                    'Fecha Solicitud Permiso': parseDateValue(row['Fecha Solicitud Permiso']),
                    'Fecha Autorización Permiso': parseDateValue(row['Fecha Autorización Permiso']),
                    'Verificado': parseDateValue(row['Verificado']),
                };
                
                if (verifiedDaneSet.has(rowDane)) {
                    return {
                        ...parsedRow,
                        'Verificado': verificationDate,
                        'Estado del Reporte': 'Verificado',
                    };
                }
                return parsedRow;
            });
            
            const headers = [
                'Municipio', 'DANE ESTABLECIMIENTO EDUCATIVO', 'ESTABLECIMIENTO EDUCATIVO', 'Cédula', 'Nombre Completo', 'Cargo Actual',
                'Fecha Inicio', 'Fecha Final', 'Fecha Ausencia menos de un día', 'Hora Inicio', 'Hora Final', 
                'Fecha Solicitud Permiso', 'Fecha Autorización Permiso', 'Motivo de Permiso', 'Observaciones', 'Verificado', 'Estado del Reporte', 'Observación del Director'
            ];
            
            const newSheet = XLSX.utils.json_to_sheet(updatedData, { header: headers, cellDates: true });
            const dateColumns = [6, 7, 8, 11, 12];
            const dateTimeColumns = [15];
            const range = XLSX.utils.decode_range(newSheet['!ref']!);
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                for (const C of dateColumns) {
                    const cell_address = XLSX.utils.encode_cell({c: C, r: R});
                    if (!newSheet[cell_address] || !newSheet[cell_address].v) continue;
                    newSheet[cell_address].t = 'd';
                    newSheet[cell_address].z = 'dd/mm/yyyy';
                }
                for (const C of dateTimeColumns) {
                    const cell_address = XLSX.utils.encode_cell({c: C, r: R});
                    if (!newSheet[cell_address] || !newSheet[cell_address].v) continue;
                    newSheet[cell_address].t = 'd';
                    newSheet[cell_address].z = 'dd/mm/yyyy hh:mm:ss';
                }
            }

            newSheet['!cols'] = [
                { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 40 }, { wch: 40 },
                { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, 
                { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 50 }, { wch: 20 }, { wch: 25 }, { wch: 50 }
            ];

            workbook.Sheets[workbook.SheetNames[0]] = newSheet;
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            await file.save(buffer, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            return { success: true };

        } catch (error: any) {
            console.error("Error in verifyReportsFlow:", error);
            return { success: false, error: error.message || 'Ocurrió un error al verificar los reportes.' };
        }
    }
);
