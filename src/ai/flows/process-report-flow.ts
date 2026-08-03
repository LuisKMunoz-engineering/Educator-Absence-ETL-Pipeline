
'use server';
/**
 * @fileOverview A flow to process and save absenteeism reports using Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as XLSX from 'xlsx';
import { storage } from '@/lib/firebase-admin';
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

const ProcessReportOutputSchema = z.object({
    success: z.boolean(),
    reportExists: z.boolean().optional(),
    isRejected: z.boolean().optional(),
    rejectionObservation: z.string().optional(),
    existingReports: z.array(reportItemSchema).optional(),
    error: z.string().optional(),
});

export async function processReport(input: z.infer<typeof ProcessReportInputSchema>): Promise<z.infer<typeof ProcessReportOutputSchema>> {
    return processReportFlow(input);
}

const processReportFlow = ai.defineFlow(
    { name: 'processReportFlow', inputSchema: ProcessReportInputSchema, outputSchema: ProcessReportOutputSchema },
    async (input) => {
        try {
            const fileName = `reports/Ausentismo_${input.month}.xlsx`;
            const bucket = storage.bucket();
            const file = bucket.file(fileName);

            let workbook: XLSX.WorkBook;
            let existingData: any[] = [];
            let fileExists = false;

            try {
                const [exists] = await file.exists();
                if (exists) {
                    fileExists = true;
                    const [fileBuffer] = await file.download();
                    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
                    const sheetName = workbook.SheetNames[0];
                    if (sheetName) {
                        existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });
                    }
                } else {
                    workbook = XLSX.utils.book_new();
                }
            } catch (e) {
                workbook = XLSX.utils.book_new();
            }

            const institutionRecords = existingData.filter(row =>
                String(row['DANE ESTABLECIMIENTO EDUCATIVO']) === String(input.daneNumber)
            );

            const isRejected = institutionRecords.some(row => row['Estado del Reporte'] === 'Rechazado para corrección');
            const blockingReportExists = institutionRecords.some(row => 
                row['Estado del Reporte'] !== 'Rechazado para corrección'
            );

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
                    return { 
                        success: true, 
                        reportExists: false, 
                        isRejected: true,
                        rejectionObservation: firstRowWithObs ? String(firstRowWithObs['Observación del Director']) : 'Reporte rechazado.',
                        existingReports: mappedReports 
                    };
                }
                return { success: true, reportExists: blockingReportExists };
            }
            
            if (!input.reports) throw new Error("No reports data provided.");

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
                const otherInstitutionsData = processedExistingData.filter(row =>
                    String(row['DANE ESTABLECIMIENTO EDUCATIVO']) !== String(input.daneNumber)
                );
                finalData = [...otherInstitutionsData, ...newRows];
            } else {
                finalData = [...processedExistingData, ...newRows];
            }
            
            const headers = [
                'Municipio', 'DANE ESTABLECIMIENTO EDUCATIVO', 'ESTABLECIMIENTO EDUCATIVO', 'Cédula', 'Nombre Completo', 'Cargo Actual',
                'Fecha Inicio', 'Fecha Final', 'Fecha Ausencia menos de un día', 'Hora Inicio', 'Hora Final', 
                'Fecha Solicitud Permiso', 'Fecha Autorización Permiso', 'Motivo de Permiso', 'Observaciones', 'Verificado', 'Estado del Reporte', 'Observación del Director'
            ];
            
            const newSheet = XLSX.utils.json_to_sheet(finalData, { header: headers, cellDates: true });
            if (workbook.SheetNames.length === 0) {
                XLSX.utils.book_append_sheet(workbook, newSheet, `Reporte ${input.month}`);
            } else {
                workbook.Sheets[workbook.SheetNames[0]] = newSheet;
            }

            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            await file.save(buffer, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            return { success: true };

        } catch (error: any) {
            console.error("Error in processReportFlow:", error);
            return { success: false, error: error.message };
        }
    }
);
