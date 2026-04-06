'use server';
/**
 * @fileOverview A flow to retrieve absenteeism reports for verification by a director.
 *
 * - getReportsForVerification - Fetches reports for specific DANE codes and a specific month.
 * - GetReportsForVerificationInput - The input type for the getReportsForVerification function.
 * - GetReportsForVerificationOutput - The return type for the getReportsForVerification function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import * as path from 'path';

// This schema should match the structure of a single report item in the Excel file.
const ReportItemSchema = z.object({
    'Municipio': z.string().optional(),
    'DANE ESTABLECIMIENTO EDUCATIVO': z.union([z.string(), z.number()]),
    'ESTABLECIMIENTO EDUCATIVO': z.string(),
    'Cédula': z.union([z.string(), z.number()]),
    'Nombre Completo': z.string(),
    'Cargo Actual': z.string().optional(),
    'Fecha Inicio': z.string().optional(),
    'Fecha Final': z.string().optional(),
    'Fecha Ausencia menos de un día': z.string().optional(),
    'Hora Inicio': z.string().optional(),
    'Hora Final': z.string().optional(),
    'Fecha Solicitud Permiso': z.string().optional(),
    'Fecha Autorización Permiso': z.string().optional(),
    'Motivo de Permiso': z.string().optional(),
    'Observaciones': z.string().optional(),
    'Verificado': z.string().optional(),
    'Estado del Reporte': z.string().optional(),
});
type ReportItem = z.infer<typeof ReportItemSchema>;


const GetReportsForVerificationInputSchema = z.object({
    daneCodes: z.array(z.string()),
    month: z.string(),
});
export type GetReportsForVerificationInput = z.infer<typeof GetReportsForVerificationInputSchema>;


const GetReportsForVerificationOutputSchema = z.object({
    success: z.boolean(),
    reports: z.array(ReportItemSchema).optional(),
    fullyVerifiedDaneCodes: z.array(z.string()).optional(),
    error: z.string().optional(),
    message: z.string().optional(),
});
export type GetReportsForVerificationOutput = z.infer<typeof GetReportsForVerificationOutputSchema>;


const REPORTS_DIR = path.join(process.cwd(), 'storage', 'reports');

// Main exported function that the client will call.
export async function getReportsForVerification(input: GetReportsForVerificationInput): Promise<GetReportsForVerificationOutput> {
    return getReportsForVerificationFlow(input);
}


const getReportsForVerificationFlow = ai.defineFlow(
    {
        name: 'getReportsForVerificationFlow',
        inputSchema: GetReportsForVerificationInputSchema,
        outputSchema: GetReportsForVerificationOutputSchema,
    },
    async (input) => {
        try {
            const fileName = `Ausentismo_${input.month}.xlsx`;
            const filePath = path.join(REPORTS_DIR, fileName);

            try {
                await fs.access(filePath);
            } catch (e) {
                return { success: true, reports: [], message: 'No existe un archivo de reporte para el mes seleccionado.' };
            }

            const fileBuffer = await fs.readFile(filePath);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];

            if (!sheetName) {
                 return { success: true, reports: [], message: 'El archivo de reporte para este mes está vacío.' };
            }
            
            // Use `raw: false` to get formatted strings as they appear in Excel.
            // This is critical to read dates formatted as dd/mm/yyyy correctly.
            const allReports: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });


            const daneCodeSet = new Set(input.daneCodes);
            
            const filteredReports = allReports.filter(report => {
                const reportDane = String(report['DANE ESTABLECIMIENTO EDUCATIVO']);
                return daneCodeSet.has(reportDane);
            });
            
            const reportsByDane: Record<string, ReportItem[]> = {};
            filteredReports.forEach(r => {
                const dane = String(r['DANE ESTABLECIMIENTO EDUCATIVO']);
                if (!reportsByDane[dane]) {
                    reportsByDane[dane] = [];
                }
                reportsByDane[dane].push(r);
            });
            
            const fullyVerifiedDaneCodes: string[] = [];
            for (const daneCode of Object.keys(reportsByDane)) {
                const institutionReports = reportsByDane[daneCode];
                // An institution is fully verified if ALL its report rows have a value in the 'Verificado' column.
                const allVerified = institutionReports.every(report => report['Verificado'] && String(report['Verificado']).trim() !== '');
                if (allVerified) {
                    fullyVerifiedDaneCodes.push(daneCode);
                }
            }
            
            // Ensure all fields are strings as the schema expects, just in case of any rogue data types.
            const validatedReports = filteredReports.map(report => {
                const newReport: { [key: string]: any } = {};
                for (const key in report) {
                    if (Object.prototype.hasOwnProperty.call(report, key)) {
                        newReport[key] = report[key] !== null && report[key] !== undefined ? String(report[key]) : '';
                    }
                }
                return newReport as ReportItem;
            });

            return { success: true, reports: validatedReports, fullyVerifiedDaneCodes };

        } catch (error: any) {
            console.error("Error in getReportsForVerificationFlow:", error);
            return { success: false, error: error.message || 'Ocurrió un error desconocido al obtener los reportes.' };
        }
    }
);
