
'use server';
/**
 * @fileOverview A flow to process and save absenteeism reports locally.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { format, parseISO, isValid } from 'date-fns';

/**
 * Parses a date string from the client (YYYY-MM-DD) into a JS Date object.
 * Sets time to noon to avoid timezone shift issues.
 */
const parseInputDate = (dateString?: string) => {
    if (!dateString || dateString.trim() === '') return undefined;
    try {
        const date = parseISO(dateString);
        if (!isValid(date)) return undefined;
        // Ensure noon to avoid UTC/Local shifts
        date.setHours(12, 0, 0, 0);
        return date;
    } catch (e) {
        return undefined;
    }
};

/**
 * Normalizes values from Excel to JS Date objects.
 */
const parseDateValue = (value?: any): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    
    // If it's a serial number from Excel (unlikely with raw:false but possible)
    if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        return new Date(date.y, date.m - 1, date.d, 12, 0, 0);
    }

    if (typeof value === 'string' && value.trim() !== '') {
        // Try DD/MM/YYYY common in our Excel exports
        const parts = value.split('/');
        if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            const date = new Date(y, m, d, 12, 0, 0);
            if (!isNaN(date.getTime())) return date;
        }

        const fallbackDate = new Date(value);
        if (!isNaN(fallbackDate.getTime())) {
            fallbackDate.setHours(12, 0, 0, 0);
            return fallbackDate;
        }
    }
    return undefined;
};

/**
 * Safely formats a date to YYYY-MM-DD for HTML inputs.
 */
const formatDateForInput = (value: any): string => {
    const date = parseDateValue(value);
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
};

/**
 * Helper to auto-adjust Excel column widths based on content.
 */
function autoAdjustColumns(sheet: XLSX.WorkSheet, data: any[]) {
    if (!data || data.length === 0) return;
    const keys = Object.keys(data[0]);
    const columnWidths = keys.map(key => {
        let maxLen = key.toString().length;
        for (const row of data) {
            const val = row[key];
            if (val !== undefined && val !== null) {
                const len = val.toString().length;
                if (len > maxLen) maxLen = len;
            }
        }
        return { wch: Math.min(maxLen + 4, 50) }; // Buffer and max limit
    });
    sheet['!cols'] = columnWidths;
}

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

const ProcessReportInputSchema = z.object({
    month: z.string(),
    municipality: z.string(),
    daneNumber: z.string(),
    reporterName: z.string().optional(),
    reporterPosition: z.string().optional(),
    institutionName: z.string().optional(),
    reports: z.array(reportItemSchema).optional(),
    action: z.enum(['check', 'overwrite', 'append']),
});

export async function processReport(input: z.infer<typeof ProcessReportInputSchema>) {
    return processReportFlow(input);
}

const processReportFlow = ai.defineFlow(
    { name: 'processReportFlow', inputSchema: ProcessReportInputSchema, outputSchema: z.any() },
    async (input) => {
        try {
            const reportsDir = path.join(process.cwd(), 'storage', 'reports');
            await fs.mkdir(reportsDir, { recursive: true });
            const filePath = path.join(reportsDir, `Ausentismo_${input.month}.xlsx`);

            let existingData: any[] = [];
            try {
                const fileBuffer = await fs.readFile(filePath);
                const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
                existingData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: true });
            } catch (e) {}

            const institutionRecords = existingData.filter(row => String(row['DANE ESTABLECIMIENTO EDUCATIVO']) === String(input.daneNumber));
            const isRejected = institutionRecords.some(row => row['Estado del Reporte'] === 'Rechazado para corrección');

            if (input.action === 'check') {
                if (isRejected) {
                    const firstRowWithObs = institutionRecords.find(row => row['Observación del Director']);
                    const mappedReports = institutionRecords.map(row => ({
                        cedula: String(row['Cédula'] || ''),
                        nombreCompleto: String(row['Nombre Completo'] || ''),
                        cargoActual: String(row['Cargo Actual'] || ''),
                        fechaInicio: formatDateForInput(row['Fecha Inicio']),
                        fechaFinal: formatDateForInput(row['Fecha Final']),
                        fechaAusencia menos de un día: formatDateForInput(row['Fecha Ausencia menos de un día']),
                        horaInicio: row['Hora Inicio'] || '',
                        horaFinal: row['Hora Final'] || '',
                        fechaSolicitudPermiso: formatDateForInput(row['Fecha Solicitud Permiso']),
                        fechaAutorizacionPermiso: formatDateForInput(row['Fecha Autorización Permiso']),
                        motivoPermiso: row['Motivo de Permiso'] || '',
                        observaciones: row['Observaciones'] || '',
                        isManual: true,
                    }));
                    return JSON.parse(JSON.stringify({ 
                        success: true, 
                        reportExists: false, 
                        isRejected: true, 
                        rejectionObservation: firstRowWithObs ? String(firstRowWithObs['Observación del Director']) : 'Reporte rechazado.', 
                        existingReports: mappedReports 
                    }));
                }
                return { success: true, reportExists: institutionRecords.length > 0 };
            }

            const newRows = input.reports!.map(report => ({
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

            let finalData: any[];
            if (input.action === 'overwrite') {
                finalData = [...existingData.filter(row => String(row['DANE ESTABLECIMIENTO EDUCATIVO']) !== String(input.daneNumber)), ...newRows];
            } else {
                finalData = [...existingData, ...newRows];
            }

            const workbook = XLSX.utils.book_new();
            const sheet = XLSX.utils.json_to_sheet(finalData, { cellDates: true });
            
            // Auto-adjust column widths
            autoAdjustColumns(sheet, finalData);
            
            XLSX.utils.book_append_sheet(workbook, sheet, `Reporte ${input.month}`);
            
            const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            await fs.writeFile(filePath, buf);
            
            return { success: true };
        } catch (error: any) {
            console.error("Error processing report:", error);
            return { success: false, error: error.message };
        }
    }
);
