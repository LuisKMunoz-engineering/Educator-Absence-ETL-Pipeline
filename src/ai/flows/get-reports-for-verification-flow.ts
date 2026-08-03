'use server';
/**
 * @fileOverview A flow to retrieve absenteeism reports with unified date formatting for verification.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { format, isValid } from 'date-fns';

const GetReportsForVerificationInputSchema = z.object({
    daneCodes: z.array(z.string()),
    month: z.string(),
});

const formatDateForDisplay = (value: any): string => {
    if (!value) return '';
    if (value instanceof Date) return format(value, 'dd/MM/yyyy');
    if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        return format(new Date(date.y, date.m - 1, date.d), 'dd/MM/yyyy');
    }
    return String(value);
};

export async function getReportsForVerification(input: z.infer<typeof GetReportsForVerificationInputSchema>) {
    return getReportsForVerificationFlow(input);
}

const getReportsForVerificationFlow = ai.defineFlow(
    { name: 'getReportsForVerificationFlow', inputSchema: GetReportsForVerificationInputSchema, outputSchema: z.any() },
    async (input) => {
        try {
            const filePath = path.join(process.cwd(), 'storage', 'reports', `Ausentismo_${input.month}.xlsx`);
            const fileBuffer = await fs.readFile(filePath);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Read with raw: true to get Date objects where possible
            const allReports: any[] = XLSX.utils.sheet_to_json(sheet, { raw: true });
            
            const daneCodeSet = new Set(input.daneCodes);
            const filteredReports = allReports.filter(report => daneCodeSet.has(String(report['DANE ESTABLECIMIENTO EDUCATIVO'])));
            
            // Format all date columns for uniform display in UI
            const formattedReports = filteredReports.map(report => ({
                ...report,
                'Fecha Inicio': formatDateForDisplay(report['Fecha Inicio']),
                'Fecha Final': formatDateForDisplay(report['Fecha Final']),
                'Fecha Ausencia menos de un día': formatDateForDisplay(report['Fecha Ausencia menos de un día']),
                'Fecha Solicitud Permiso': formatDateForDisplay(report['Fecha Solicitud Permiso']),
                'Fecha Autorización Permiso': formatDateForDisplay(report['Fecha Autorización Permiso']),
                'Verificado': report['Verificado'] ? String(report['Verificado']) : undefined
            }));

            const fullyVerifiedDaneCodes = Object.keys(
                formattedReports.reduce((acc, r) => {
                    const dane = String(r['DANE ESTABLECIMIENTO EDUCATIVO']);
                    if (!acc[dane]) acc[dane] = { all: true };
                    if (!r['Verificado']) acc[dane].all = false;
                    return acc;
                }, {} as any)
            ).filter(d => formattedReports.filter(r => String(r['DANE ESTABLECIMIENTO EDUCATIVO']) === d).every(r => r['Verificado']));

            return JSON.parse(JSON.stringify({ success: true, reports: formattedReports, fullyVerifiedDaneCodes }));
        } catch (e) {
            return { success: true, reports: [], message: 'No hay reportes para este mes.' };
        }
    }
);