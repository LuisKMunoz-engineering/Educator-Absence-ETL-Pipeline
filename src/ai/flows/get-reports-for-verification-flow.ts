'use server';
/**
 * @fileOverview A flow to retrieve absenteeism reports locally.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

const GetReportsForVerificationInputSchema = z.object({
    daneCodes: z.array(z.string()),
    month: z.string(),
});

export async function getReportsForVerification(input: z.infer<typeof GetReportsForVerificationInputSchema>) {
    return getReportsForVerificationFlow(input);
}

const getReportsForVerificationFlow = ai.defineFlow(
    { name: 'getReportsForVerificationFlow', inputSchema: GetReportsForVerificationInputSchema, outputSchema: z.any() },
    async (input) => {
        try {
            const filePath = path.join(process.cwd(), 'storage', 'reports', `Ausentismo_${input.month}.xlsx`);
            const fileBuffer = await fs.readFile(filePath);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const allReports: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false });
            
            const daneCodeSet = new Set(input.daneCodes);
            const filteredReports = allReports.filter(report => daneCodeSet.has(String(report['DANE ESTABLECIMIENTO EDUCATIVO'])));
            
            const fullyVerifiedDaneCodes = Object.keys(
                filteredReports.reduce((acc, r) => {
                    const dane = String(r['DANE ESTABLECIMIENTO EDUCATIVO']);
                    if (!acc[dane]) acc[dane] = { all: true };
                    if (!r['Verificado']) acc[dane].all = false;
                    return acc;
                }, {} as any)
            ).filter(d => filteredReports.filter(r => String(r['DANE ESTABLECIMIENTO EDUCATIVO']) === d).every(r => r['Verificado']));

            return { success: true, reports: filteredReports, fullyVerifiedDaneCodes };
        } catch (e) {
            return { success: true, reports: [], message: 'No hay reportes para este mes.' };
        }
    }
);
