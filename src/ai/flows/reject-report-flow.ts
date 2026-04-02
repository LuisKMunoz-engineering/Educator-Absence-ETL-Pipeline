'use server';
/**
 * @fileOverview A flow to mark an absenteeism report as rejected for correction.
 *
 * - rejectReport - Finds a report file and updates rows for a specific DANE code to 'Rechazado para corrección'.
 * - RejectReportInput - The input type for the rejectReport function.
 * - RejectReportOutput - The return type for the rejectReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import * as path from 'path';

// Helper to parse 'dd/mm/yyyy' strings or existing Date objects into a valid Date object.
// Returns undefined for empty/invalid strings to ensure empty cells in Excel.
const parseDateValue = (value?: string | Date): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) {
        // If it's already a date object, it's valid.
        return value;
    }
    if (typeof value !== 'string' || value.trim() === '') return undefined;

    // Try parsing 'dd/mm/yyyy hh:mm:ss' or 'dd/mm/yyyy' format
    const dateTimeParts = value.split(' ');
    const dateParts = dateTimeParts[0].split('/');
    
    if (dateParts.length === 3) {
        const [day, month, year] = dateParts.map(p => parseInt(p, 10));
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            // JS month is 0-indexed. Handle 2-digit and 4-digit years.
            const fullYear = year < 100 ? 2000 + year : year;
            const date = new Date(fullYear, month - 1, day);
            
            // Handle time part if it exists
            if (dateTimeParts.length > 1) {
                const timeParts = dateTimeParts[1].split(':');
                if (timeParts.length >= 2) {
                   date.setHours(parseInt(timeParts[0], 10));
                   date.setMinutes(parseInt(timeParts[1], 10));
                   if (timeParts.length > 2) {
                       date.setSeconds(parseInt(timeParts[2], 10));
                   }
                }
            }
            
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }
    
    // Fallback for other formats like ISO strings that JS Date constructor can handle
    const fallbackDate = new Date(value);
    return isNaN(fallbackDate.getTime()) ? undefined : fallbackDate;
};


const RejectReportInputSchema = z.object({
    month: z.string(),
    daneCode: z.string(),
});
export type RejectReportInput = z.infer<typeof RejectReportInputSchema>;

const RejectReportOutputSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});
export type RejectReportOutput = z.infer<typeof RejectReportOutputSchema>;

const REPORTS_DIR = path.join(process.cwd(), 'storage', 'reports');

// Main exported function that the client will call.
export async function rejectReport(input: RejectReportInput): Promise<RejectReportOutput> {
    return rejectReportFlow(input);
}

const rejectReportFlow = ai.defineFlow(
    {
        name: 'rejectReportFlow',
        inputSchema: RejectReportInputSchema,
        outputSchema: RejectReportOutputSchema,
    },
    async (input) => {
        try {
            const fileName = `Ausentismo_${input.month}.xlsx`;
            const filePath = path.join(REPORTS_DIR, fileName);
            
            let workbook: XLSX.WorkBook;
            let existingData: any[] = [];
            
            try {
                await fs.access(filePath);
                const fileBuffer = await fs.readFile(filePath);
                workbook = XLSX.read(fileBuffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                if (sheetName) {
                    // Read formatted strings to preserve original date values
                    existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });
                } else {
                    throw new Error("El archivo de reporte está vacío o corrupto.");
                }
            } catch (error) {
                return { success: false, error: "No se encontró el archivo de reporte para el mes seleccionado." };
            }
            
            const rejectedStatus = "Rechazado para corrección";

            const updatedData = existingData.map(row => {
                 // Re-parse all date fields to ensure they are Date objects for writing
                const parsedRow = {
                    ...row,
                    'Fecha Inicio': parseDateValue(row['Fecha Inicio']),
                    'Fecha Final': parseDateValue(row['Fecha Final']),
                    'Fecha Ausencia menos de un día': parseDateValue(row['Fecha Ausencia menos de un día']),
                    'Fecha Solicitud Permiso': parseDateValue(row['Fecha Solicitud Permiso']),
                    'Fecha Autorización Permiso': parseDateValue(row['Fecha Autorización Permiso']),
                    'Verificado': parseDateValue(row['Verificado']),
                };

                const rowDane = String(row['DANE ESTABLECIMIENTO EDUCATIVO']);
                if (rowDane === input.daneCode) {
                    return {
                        ...parsedRow,
                        'Estado del Reporte': rejectedStatus,
                        'Verificado': undefined, // Clear verification status, this will become an empty cell.
                    };
                }
                return parsedRow;
            });

            const headers = [
                'Municipio', 'DANE ESTABLECIMIENTO EDUCATIVO', 'ESTABLECIMIENTO EDUCATIVO', 'Cédula', 'Nombre Completo', 
                'Fecha Inicio', 'Fecha Final', 'Fecha Ausencia menos de un día', 'Hora Inicio', 'Hora Final', 
                'Fecha Solicitud Permiso', 'Fecha Autorización Permiso', 'Motivo de Permiso', 'Observaciones', 'Verificado', 'Estado del Reporte'
            ];
            
            const newSheet = XLSX.utils.json_to_sheet(updatedData, { header: headers, cellDates: true });

            const dateColumns = [5, 6, 7, 10, 11]; // F, G, H, K, L
            const dateTimeColumns = [14]; // O (Verificado)
            const range = XLSX.utils.decode_range(newSheet['!ref']!);
            for (let R = range.s.r + 1; R <= range.e.r; ++R) { // +1 to skip header
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
                { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 40 }, 
                { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, 
                { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 50 }, { wch: 20 }, { wch: 25 }
            ];

            workbook.Sheets[workbook.SheetNames[0]] = newSheet;

            await fs.writeFile(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

            return { success: true };

        } catch (error: any) {
            console.error("Error in rejectReportFlow:", error);
            return { success: false, error: error.message || 'Ocurrió un error al rechazar el reporte.' };
        }
    }
);
