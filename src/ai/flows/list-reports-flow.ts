'use server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

export async function listReports() {
    const reportsDir = path.join(process.cwd(), 'storage', 'reports');
    try {
        const files = await fs.readdir(reportsDir);
        return { success: true, reports: files.filter(f => f.endsWith('.xlsx')) };
    } catch (e) {
        return { success: true, reports: [] };
    }
}
