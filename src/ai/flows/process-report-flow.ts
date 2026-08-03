'use server';
/**
 * @fileOverview A flow to process and save absenteeism reports locally.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { format } from 'date-fns';

const parseInputDate = (dateString?: string) => {
    if (!dateString) return undefined;
    const date = new Date(`${dateString}T12:00:00`);
    return isNaN(date.getTime()) ? undefined : date;
};

const parseDateValue = (value?: string | Date): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value !== 'string' || value.trim() === '') return undefined;
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
        const reportsDir = path.join(process.cwd(), 'storage', 'reports');
        await fs.mkdir(reportsDir, { recursive: true });
        const filePath = path.join(reportsDir, `Ausentismo_${input.month}.xlsx`);

        let existingData: any[] = [];
        try {
            const fileBuffer = await fs.readFile(filePath);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            existingData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
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
                    fechaInicio: parseDateValue(row['Fecha Inicio']) ? format(parseDateValue(row['Fecha Inicio'])!, 'yyyy-MM-dd') : '',
                    fechaFinal: parseDateValue(row['Fecha Final']) ? format(parseDateValue(row['Fecha Final'])!, 'yyyy-MM-dd') : '',
                    fechaAusenciaUnDia: parseDateValue(row['Fecha Ausencia menos de un día']) ? format(parseDateValue(row['Fecha Ausencia menos de un día'])!, 'yyyy-MM-dd') : '',
                    horaInicio: row['Hora Inicio'] || '',
                    horaFinal: row['Hora Final'] || '',
                    fechaSolicitudPermiso: parseDateValue(row['Fecha Solicitud Permiso']) ? format(parseDateValue(row['Fecha Solicitud Permiso'])!, 'yyyy-MM-dd') : '',
                    fechaAutorizacionPermiso: parseDateValue(row['Fecha Autorización Permiso']) ? format(parseDateValue(row['Fecha Autorización Permiso'])!, 'yyyy-MM-dd') : '',
                    motivoPermiso: row['Motivo de Permiso'] || '',
                    observaciones: row['Observaciones'] || '',
                    isManual: true,
                }));
                return { success: true, reportExists: false, isRejected: true, rejectionObservation: firstRowWithObs ? String(firstRowWithObs['Observación del Director']) : 'Reporte rechazado.', existingReports: mappedReports };
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
        XLSX.utils.book_append_sheet(workbook, sheet, `Reporte ${input.month}`);
        XLSX.writeFile(workbook, filePath);
        
        return { success: true };
    }
);
