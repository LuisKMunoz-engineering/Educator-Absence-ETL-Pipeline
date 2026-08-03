
'use server';
/**
 * @fileOverview Flow to manage global app settings using Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase-admin';

const SettingsSchema = z.object({
    rectorEnabled: z.boolean(),
    directorEnabled: z.boolean(),
});

export type AppSettings = z.infer<typeof SettingsSchema>;

const SETTINGS_COLLECTION = 'app_settings';
const GLOBAL_SETTINGS_DOC = 'global';

export async function getAppSettings(): Promise<AppSettings> {
    return getAppSettingsFlow();
}

const getAppSettingsFlow = ai.defineFlow(
    { name: 'getAppSettingsFlow', outputSchema: SettingsSchema },
    async () => {
        try {
            const doc = await db.collection(SETTINGS_COLLECTION).doc(GLOBAL_SETTINGS_DOC).get();
            if (doc.exists) {
                return doc.data() as AppSettings;
            }
            return { rectorEnabled: true, directorEnabled: true };
        } catch (error) {
            console.error("Error fetching settings from Firestore:", error);
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
        try {
            await db.collection(SETTINGS_COLLECTION).doc(GLOBAL_SETTINGS_DOC).set(input, { merge: true });
            return { success: true };
        } catch (error) {
            console.error("Error updating settings in Firestore:", error);
            return { success: false };
        }
    }
);
