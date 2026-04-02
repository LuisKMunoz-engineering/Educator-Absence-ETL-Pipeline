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

// Helper to safely parse date strings from form inputs.
// Input is 'YYYY-MM-DD'. Using T12:00:00 to avoid timezone shifts.
const parseDate = (dateString?: string) => {
    if (!dateString) return undefined;
    const date = new Date(`${dateString}T12:00:00`);
    return isNaN(date.getTime()) ? undefined : date;
};

const reportItemSchema = z.object({
    cedula: z.string(),
    nombreCompleto: z.string(),
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

// Define the directory where reports will be stored.
const REPORTS_DIR = path.join(process.cwd(), 'storage', 'reports');

// Helper function to ensure the directory exists.
async function ensureDirectoryExists(dirPath: string) {
    try {
        await fs.access(dirPath);
    } catch (error) {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

// Main exported function that the client will call.
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
                    existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { cellDates: true });
                }
            } else {
                workbook = XLSX.utils.book_new();
            }

            const anyExistingReport = existingData.some(row =>
                String(row['DANE ESTABLECIMIENTO EDUCATIVO']) === String(input.daneNumber)
            );

            // A report is considered "blocking" if it exists and has NOT been rejected.
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

            const newRows = input.reports.map(report => ({
                'Municipio': input.municipality,
                'DANE ESTABLECIMIENTO EDUCATIVO': input.daneNumber,
                'ESTABLECIMIENTO EDUCATIVO': input.institutionName,
                'Cédula': report.cedula,
                'Nombre Completo': report.nombreCompleto,
                'Fecha Inicio': parseDate(report.fechaInicio),
                'Fecha Final': parseDate(report.fechaFinal),
                'Fecha Ausencia menos de un día': parseDate(report.fechaAusenciaUnDia),
                'Hora Inicio': report.horaInicio,
                'Hora Final': report.horaFinal,
                'Fecha Solicitud Permiso': parseDate(report.fechaSolicitudPermiso),
                'Fecha Autorización Permiso': parseDate(report.fechaAutorizacionPermiso),
                'Motivo de Permiso': report.motivoPermiso,
                'Observaciones': report.observaciones,
                'Estado del Reporte': 'Enviado',
                'Verificado': '',
            }));

            let finalData: any[];

            if (anyExistingReport) {
                const otherReports = existingData.filter(row =>
                    String(row['DANE ESTABLECIMIENTO EDUCATIVO']) !== String(input.daneNumber)
                );
                finalData = [...otherReports, ...newRows];
            } else { // 'append' for a new institution
                finalData = [...existingData, ...newRows];
            }
            
            const headers = [
                'Municipio', 'DANE ESTABLECIMIENTO EDUCATIVO', 'ESTABLECIMIENTO EDUCATIVO', 'Cédula', 'Nombre Completo', 
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
