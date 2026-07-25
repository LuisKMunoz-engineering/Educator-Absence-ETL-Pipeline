'use server';
/**
 * @fileOverview Flow to handle login validation against the JSON user store.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';

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

        // Check Admin
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            return {
                success: true,
                user: { role: 'admin', email: ADMIN_EMAIL, name: 'Administrador' }
            };
        }

        try {
            const data = await fs.readFile(USERS_FILE, 'utf-8');
            const users = JSON.parse(data) as any[];
            const user = users.find(u => u.email.toLowerCase() === email && u.password === password);

            if (user) {
                return { success: true, user };
            }
        } catch (e) {
            console.error("Login flow storage error:", e);
        }

        return { success: false, error: 'Credenciales inválidas.' };
    }
);
