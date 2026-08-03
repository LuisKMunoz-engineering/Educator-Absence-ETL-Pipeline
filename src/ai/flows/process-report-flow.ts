'use server';
/**
 * @fileOverview A flow to process and save absenteeism reports.
 *
 * - processReport - Handles checking for, and saving report data to an Excel file.
 * - ProcessReportInput - The input type for the processReport function.
 * - ProcessReportOutput - The return type for the processReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import * as path from 'path';

// Helper to safely parse date strings from form inputs (YYYY-MM-DD).
const parseInputDate = (dateString?: string) => {
    if (!dateString) return undefined;
    const date = new Date(`${dateString}T12:00:00`);
    return isNaN(date.getTime()) ? undefined : date;
};

// Robust helper to parse 'dd/mm/yyyy' strings or existing Date objects.
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

const reportItemSchema = z.object({
    cedula: z.string(),
    nombreCompleto: z.string(),
    cargoActual: z.string().optional(),
    fechaInicio: z.string().optional(),
    fechaFinal: z.string().optional(),
    fechaAusenciaUnDia: z.string().optional(),
    horaInicio: z.string().optional(),
    horaFinal: z.string().optional(),
    fechaSolicitudPermiso: z.string().optional(),
    fechaAutorizacionPermiso: z.string().optional(),
    motivoPermiso: z.string().optional(),
    observaciones: z.string().optional(),
    isManual: z.boolean().optional(),
});

const CheckExistingInputSchema = z.object({
    month: z.string(),
    municipality: z.string(),
    daneNumber: z.string(),
});
export type CheckExistingInput = z.infer<typeof CheckExistingInputSchema>;

const ProcessReportInputSchema = CheckExistingInputSchema.extend({
    reporterName: z.string().optional(),
    reporterPosition: z.string().optional(),
    institutionName: z.string().optional(),
    reports: z.array(reportItemSchema).optional(),
    action: z.enum(['check', 'overwrite', 'append']),
});
export type ProcessReportInput = z.infer<typeof ProcessReportInputSchema>;

const ProcessReportOutputSchema = z.object({
    success: z.boolean(),
    reportExists: z.boolean().optional(),
    error: z.string().optional(),
    filePath: z.string().optional(),
});
export type ProcessReportOutput = z.infer<typeof ProcessReportOutputSchema>;

const REPORTS_DIR = path.join(process.cwd(), 'storage', 'reports');

async function ensureDirectoryExists(dirPath: string) {
    try {
        await fs.access(dirPath);
    } catch (error) {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

export async function processReport(input: ProcessReportInput): Promise<ProcessReportOutput> {
    return processReportFlow(input);
}

const processReportFlow = ai.defineFlow(
    {
        name: 'processReportFlow',
        inputSchema: ProcessReportInputSchema,
        outputSchema: ProcessReportOutputSchema,
    },
    async (input) => {
        try {
            await ensureDirectoryExists(REPORTS_DIR);
            const fileName = `Ausentismo_${input.month}.xlsx`;
            const filePath = path.join(REPORTS_DIR, fileName);

            let workbook: XLSX.WorkBook;
            let existingData: any[] = [];
            let fileExists = false;

            try {
                await fs.access(filePath);
                fileExists = true;
            } catch (e) {
                fileExists = false;
            }

            if (fileExists) {
                const fileBuffer = await fs.readFile(filePath);
                workbook = XLSX.read(fileBuffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                if (sheetName) {
                    // Read formatted strings to preserve 'dd/mm/yyyy'
                    existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });
                }
            } else {
                workbook = XLSX.utils.book_new();
            }

            // Check for existing records of THIS institution in the current month file
            const blockingReportExists = existingData.some(row =>
                String(row['DANE ESTABLECIMIENTO EDUCATIVO']) === String(input.daneNumber) &&
                row['Estado del Reporte'] !== 'Rechazado para corrección'
            );

            if (input.action === 'check') {
                return { success: true, reportExists: blockingReportExists };
            }
            
            if (!input.reports) {
                throw new Error("No reports data provided for saving.");
            }

            // Map new rows from frontend
            const newRows = input.reports.map(report => ({
                'Municipio': input.municipality,
                'DANE ESTABLECIMIENTO EDUCATIVO': input.daneNumber,
                'ESTABLECIMIENTO EDUCATIVO': input.institutionName,
                'Cédula': report.cedula,
                'Nombre Completo': report.nombreCompleto,
                'Cargo Actual': report.cargoActual,
                'Fecha Inicio': parseInputDate(report.fechaInicio),
                'Fecha Final': parseInputDate(report.fechaFinal),
                'Fecha Ausencia menos de un día': parseInputDate(report.fechaAusenciaUnDia),
                'Hora Inicio': report.horaInicio,
                'Hora Final': report.horaFinal,
                'Fecha Solicitud Permiso': parseInputDate(report.fechaSolicitudPermiso),
                'Fecha Autorización Permiso': parseInputDate(report.fechaAutorizacionPermiso),
                'Motivo de Permiso': report.motivoPermiso,
                'Observaciones': report.observaciones,
                'Estado del Reporte': 'Enviado',
                'Verificado': undefined,
            }));

            // Crucial: Process existing data ensuring dates are correctly parsed Date objects
            const processedExistingData = existingData.map(row => ({
                ...row,
                'Fecha Inicio': parseDateValue(row['Fecha Inicio']),
                'Fecha Final': parseDateValue(row['Fecha Final']),
                'Fecha Ausencia menos de un día': parseDateValue(row['Fecha Ausencia menos de un día']),
                'Fecha Solicitud Permiso': parseDateValue(row['Fecha Solicitud Permiso']),
                'Fecha Autorización Permiso': parseDateValue(row['Fecha Autorización Permiso']),
                'Verificado': parseDateValue(row['Verificado']),
            }));

            let finalData: any[];
            
            if (input.action === 'overwrite') {
                // Remove ALL existing records for THIS DANE and replace with new ones
                const otherInstitutionsData = processedExistingData.filter(row =>
                    String(row['DANE ESTABLECIMIENTO EDUCATIVO']) !== String(input.daneNumber)
                );
                finalData = [...otherInstitutionsData, ...newRows];
            } else {
                // For 'append', we keep EVERY row in the file and just add the new ones at the end
                finalData = [...processedExistingData, ...newRows];
            }
            
            const headers = [
                'Municipio', 'DANE ESTABLECIMIENTO EDUCATIVO', 'ESTABLECIMIENTO EDUCATIVO', 'Cédula', 'Nombre Completo', 'Cargo Actual',
                'Fecha Inicio', 'Fecha Final', 'Fecha Ausencia menos de un día', 'Hora Inicio', 'Hora Final', 
                'Fecha Solicitud Permiso', 'Fecha Autorización Permiso', 'Motivo de Permiso', 'Observaciones', 'Verificado', 'Estado del Reporte'
            ];
            
            const orderedData = finalData.map(row => {
                const orderedRow: {[key: string]: any} = {};
                headers.forEach(header => {
                    orderedRow[header] = row[header] ?? '';
                });
                return orderedRow;
            });

            const newSheet = XLSX.utils.json_to_sheet(orderedData, { header: headers, cellDates: true });
            
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
                { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 50 }, { wch: 20 }, { wch: 25 }
            ];
            
            if (workbook.SheetNames.length === 0) {
                XLSX.utils.book_append_sheet(workbook, newSheet, `Reporte ${input.month}`);
            } else {
                workbook.Sheets[workbook.SheetNames[0]] = newSheet;
            }

            await fs.writeFile(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

            return { success: true, filePath };

        } catch (error: any) {
            console.error("Error in processReportFlow:", error);
            return { success: false, error: error.message || 'An unknown error occurred.' };
        }
    }
);