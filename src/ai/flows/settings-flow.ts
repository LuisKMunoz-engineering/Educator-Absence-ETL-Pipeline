'use server';
/**
 * @fileOverview Flow to manage global app settings like access control for roles.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const SETTINGS_FILE = path.join(STORAGE_DIR, 'settings.json');

const SettingsSchema = z.object({
    rectorEnabled: z.boolean(),
    directorEnabled: z.boolean(),
});

export type AppSettings = z.infer<typeof SettingsSchema>;

async function ensureStorage() {
    try {
        await fs.access(STORAGE_DIR);
    } catch {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
    }
}

export async function getAppSettings(): Promise<AppSettings> {
    return getAppSettingsFlow();
}

const getAppSettingsFlow = ai.defineFlow(
    { name: 'getAppSettingsFlow', outputSchema: SettingsSchema },
    async () => {
        try {
            await ensureStorage();
            const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
            return JSON.parse(data);
        } catch {
            // Default settings if file doesn't exist
            return { rectorEnabled: true, directorEnabled: true };
        }
    }
);

export async function updateAppSettings(settings: AppSettings) {
    return updateAppSettingsFlow(settings);
}

const updateAppSettingsFlow = ai.defineFlow(
    { name: 'updateAppSettingsFlow', inputSchema: SettingsSchema, outputSchema: z.object({ success: z.boolean() }) },
    async (input) => {
        await ensureStorage();
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(input, null, 2), 'utf-8');
        return { success: true };
    }
);
