'use server';
/**
 * @fileOverview Flow to manage global app settings using local JSON storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

const SettingsSchema = z.object({
    rectorEnabled: z.boolean(),
    directorEnabled: z.boolean(),
});

export type AppSettings = z.infer<typeof SettingsSchema>;

const SETTINGS_PATH = path.join(process.cwd(), 'storage', 'settings.json');

async function ensureStorageDir() {
    const storageDir = path.join(process.cwd(), 'storage');
    await fs.mkdir(storageDir, { recursive: true });
}

export async function getAppSettings(): Promise<AppSettings> {
    try {
        await ensureStorageDir();
        const data = await fs.readFile(SETTINGS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // Default settings
        return { rectorEnabled: true, directorEnabled: true };
    }
}

export async function updateAppSettings(settings: AppSettings) {
    try {
        await ensureStorageDir();
        await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
        return { success: true };
    } catch (error) {
        console.error("Error updating settings locally:", error);
        return { success: false };
    }
}

// Genkit Flow definitions for consistency
const getAppSettingsFlow = ai.defineFlow(
    { name: 'getAppSettingsFlow', outputSchema: SettingsSchema },
    async () => {
        return getAppSettings();
    }
);

const updateAppSettingsFlow = ai.defineFlow(
    { name: 'updateAppSettingsFlow', inputSchema: SettingsSchema, outputSchema: z.object({ success: z.boolean() }) },
    async (input) => {
        return updateAppSettings(input);
    }
);
