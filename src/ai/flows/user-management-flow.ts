'use server';
/**
 * @fileOverview Flow to manage users (Rectores and Directores) in a JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as XLSX from 'xlsx';

const UserSchema = z.object({
    email: z.string(),
    password: z.string(),
    role: z.enum(['rector', 'director']),
    name: z.string(),
    municipality: z.string().optional(),
    dane: z.string().optional(),
    institution: z.string().optional(),
    cedula: z.string().optional(),
    daneCodes: z.array(z.string()).optional(),
});

export type User = z.infer<typeof UserSchema>;

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const USERS_FILE = path.join(STORAGE_DIR, 'users.json');

async function ensureStorage() {
    try {
        await fs.access(STORAGE_DIR);
    } catch {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
    }
}

async function readUsers(): Promise<User[]> {
    try {
        await ensureStorage();
        const data = await fs.readFile(USERS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function writeUsers(users: User[]) {
    await ensureStorage();
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

export async function getUsers() {
    return getUsersFlow();
}

const getUsersFlow = ai.defineFlow(
    { name: 'getUsersFlow', outputSchema: z.array(UserSchema) },
    async () => {
        return await readUsers();
    }
);

export async function saveUser(user: User) {
    return saveUserFlow(user);
}

const saveUserFlow = ai.defineFlow(
    { name: 'saveUserFlow', inputSchema: UserSchema, outputSchema: z.object({ success: z.boolean() }) },
    async (input) => {
        const users = await readUsers();
        const index = users.findIndex(u => u.email.toLowerCase() === input.email.toLowerCase());
        if (index > -1) {
            users[index] = input;
        } else {
            users.push(input);
        }
        await writeUsers(users);
        return { success: true };
    }
);

export async function deleteUser(email: string) {
    return deleteUserFlow(email);
}

const deleteUserFlow = ai.defineFlow(
    { name: 'deleteUserFlow', inputSchema: z.string(), outputSchema: z.object({ success: z.boolean() }) },
    async (email) => {
        const users = await readUsers();
        const filtered = users.filter(u => u.email.toLowerCase() !== email.toLowerCase());
        await writeUsers(filtered);
        return { success: true };
    }
);

// One-time sync from Excel to JSON if JSON is empty
export async function syncFromExcel() {
    return syncFromExcelFlow();
}

const syncFromExcelFlow = ai.defineFlow(
    { name: 'syncFromExcelFlow', outputSchema: z.object({ success: z.boolean(), count: z.number() }) },
    async () => {
        const users: User[] = await readUsers();
        if (users.length > 0) return { success: true, count: users.length };

        const newUsers: User[] = [];

        // Try syncing rectores
        try {
            const rectoresPath = path.join(process.cwd(), 'public', 'data', 'rectores.xlsx');
            const workbook = XLSX.readFile(rectoresPath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet) as any[];
            data.forEach(row => {
                newUsers.push({
                    email: String(row['EMAIL'] || '').trim(),
                    password: String(row['contraseña'] || '12345').trim(),
                    role: 'rector',
                    name: String(row['NOMBRE DEL RECTOR O DIRECTOR RURAL'] || ''),
                    municipality: String(row['MUNICIPIO'] || ''),
                    dane: String(row['DANE'] || ''),
                    institution: String(row['ESTABLECIMIENTO EDUCATIVO'] || ''),
                });
            });
        } catch (e) { console.error("Sync Rectores failed:", e); }

        // Try syncing directores
        try {
            const directoresPath = path.join(process.cwd(), 'public', 'data', 'directoresDeNucleo.xlsx');
            const workbook = XLSX.readFile(directoresPath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet) as any[];
            
            const directorMap = new Map<string, User>();
            data.forEach(row => {
                const email = String(row['Correo electrónico'] || '').trim();
                if (!email) return;
                
                if (!directorMap.has(email)) {
                    directorMap.set(email, {
                        email,
                        password: '012295', // Legacy fixed password
                        role: 'director',
                        name: String(row['NOMBRE'] || ''),
                        cedula: String(row['IDENTIFICACIÓN'] || ''),
                        daneCodes: []
                    });
                }
                const dir = directorMap.get(email)!;
                const dane = String(row['CODIGO DANE'] || '');
                if (dane && !dir.daneCodes?.includes(dane)) {
                    dir.daneCodes?.push(dane);
                }
            });
            newUsers.push(...Array.from(directorMap.values()));
        } catch (e) { console.error("Sync Directores failed:", e); }

        if (newUsers.length > 0) {
            await writeUsers(newUsers);
        }

        return { success: true, count: newUsers.length };
    }
);
