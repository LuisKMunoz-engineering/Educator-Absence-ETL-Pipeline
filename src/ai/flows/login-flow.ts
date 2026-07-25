'use server';
/**
 * @fileOverview Flow to handle login validation against the JSON user store and access settings.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getAppSettings } from './settings-flow';

const USERS_FILE = path.join(process.cwd(), 'storage', 'users.json');
const ADMIN_EMAIL = 'admin';
const ADMIN_PASSWORD = '12345';

const LoginInputSchema = z.object({
    email: z.string(),
    password: z.string(),
});

const LoginOutputSchema = z.object({
    success: z.boolean(),
    user: z.any().optional(),
    error: z.string().optional(),
});

export async function login(input: z.infer<typeof LoginInputSchema>) {
    return loginFlow(input);
}

const loginFlow = ai.defineFlow(
    { name: 'loginFlow', inputSchema: LoginInputSchema, outputSchema: LoginOutputSchema },
    async (input) => {
        const email = input.email.trim().toLowerCase();
        const password = input.password.trim();

        // Check Admin - Admin always has access regardless of settings
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            return {
                success: true,
                user: { role: 'admin', email: ADMIN_EMAIL, name: 'Administrador' }
            };
        }

        try {
            // Load App Settings for access control
            const settings = await getAppSettings();

            await fs.access(USERS_FILE);
            const data = await fs.readFile(USERS_FILE, 'utf-8');
            const users = JSON.parse(data) as any[];
            
            const user = users.find(u => 
                String(u.email).toLowerCase().trim() === email && 
                String(u.password).trim() === password
            );

            if (user) {
                // Check if the role is enabled based on settings
                if (user.role === 'rector' && !settings.rectorEnabled) {
                    return { success: false, error: 'El acceso para Rectores está cerrado según el cronograma de la SED-CAUCA.' };
                }
                if (user.role === 'director' && !settings.directorEnabled) {
                    return { success: false, error: 'El acceso para Directores de Núcleo está cerrado según el cronograma de la SED-CAUCA.' };
                }

                return { success: true, user };
            }
        } catch (e) {
            console.error("Login flow storage error or file missing:", e);
        }

        return { success: false, error: 'Credenciales inválidas o el sistema de usuarios no ha sido inicializado.' };
    }
);
