'use server';
/**
 * @fileOverview Flow to handle login validation against Firestore and app settings.
 * Includes hardcoded credentials for the initial admin access.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase-admin';
import { getAppSettings } from './settings-flow';

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
        const email = (input.email || '').trim().toLowerCase();
        const password = (input.password || '').trim();

        // 1. Verificación Prioritaria de Administrador (Hardcoded)
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            console.log("Admin login detected");
            return {
                success: true,
                user: { role: 'admin', email: ADMIN_EMAIL, name: 'Administrador' }
            };
        }

        // 2. Verificación de Usuarios en Firestore
        try {
            const userDoc = await db.collection('users').doc(email).get();
            
            if (!userDoc.exists) {
                return { success: false, error: 'Usuario no encontrado. Verifique sus credenciales.' };
            }

            const user = userDoc.data();
            if (!user || String(user.password).trim() !== password) {
                return { success: false, error: 'Contraseña incorrecta.' };
            }

            // 3. Verificación de Cronograma (Settings)
            // Solo se consulta si no es admin
            const settings = await getAppSettings();
            
            if (user.role === 'rector' && settings.rectorEnabled === false) {
                return { success: false, error: 'El acceso para Rectores está cerrado según el cronograma.' };
            }
            if (user.role === 'director' && settings.directorEnabled === false) {
                return { success: false, error: 'El acceso para Directores está cerrado según el cronograma.' };
            }

            return { success: true, user };

        } catch (e: any) {
            console.error("Login flow error:", e);
            return { success: false, error: 'Error de conexión con la base de datos. Intente nuevamente.' };
        }
    }
);