'use server';
/**
 * @fileOverview Flow to handle login validation against local users.json.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

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

        // Admin Hardcoded
        if (email === 'admin' && password === '12345') {
            return {
                success: true,
                user: { role: 'admin', email: 'admin', name: 'Administrador' }
            };
        }

        try {
            const usersPath = path.join(process.cwd(), 'storage', 'users.json');
            const fileContent = await fs.readFile(usersPath, 'utf-8');
            const users = JSON.parse(fileContent);
            
            const user = users.find((u: any) => u.email.toLowerCase() === email && String(u.password) === password);

            if (!user) {
                return { success: false, error: 'Usuario o contraseña incorrectos.' };
            }

            return { success: true, user };
        } catch (e) {
            console.error("Login error:", e);
            return { success: false, error: 'Error al validar credenciales.' };
        }
    }
);
