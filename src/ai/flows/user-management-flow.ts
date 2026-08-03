
'use server';
/**
 * @fileOverview Flow to manage users using Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db, storage } from '@/lib/firebase-admin';
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

const USERS_COLLECTION = 'users';

export async function getUsers() {
    return getUsersFlow();
}

const getUsersFlow = ai.defineFlow(
    { name: 'getUsersFlow', outputSchema: z.array(UserSchema) },
    async () => {
        const snapshot = await db.collection(USERS_COLLECTION).get();
        return snapshot.docs.map(doc => doc.data() as User);
    }
);

export async function saveUser(user: User) {
    return saveUserFlow(user);
}

const saveUserFlow = ai.defineFlow(
    { name: 'saveUserFlow', inputSchema: UserSchema, outputSchema: z.object({ success: z.boolean() }) },
    async (input) => {
        const userRef = db.collection(USERS_COLLECTION).doc(input.email.toLowerCase().trim());
        await userRef.set(input, { merge: true });
        return { success: true };
    }
);

export async function deleteUser(email: string) {
    return deleteUserFlow(email);
}

const deleteUserFlow = ai.defineFlow(
    { name: 'deleteUserFlow', inputSchema: z.string(), outputSchema: z.object({ success: z.boolean() }) },
    async (email) => {
        await db.collection(USERS_COLLECTION).doc(email.toLowerCase().trim()).delete();
        return { success: true };
    }
);

export async function syncFromExcel() {
    return syncFromExcelFlow();
}

const syncFromExcelFlow = ai.defineFlow(
    { name: 'syncFromExcelFlow', outputSchema: z.object({ success: z.boolean(), count: z.number(), error: z.string().optional() }) },
    async () => {
        try {
            // Check if we already have users
            const snapshot = await db.collection(USERS_COLLECTION).limit(1).get();
            if (!snapshot.empty) {
                const total = await db.collection(USERS_COLLECTION).count().get();
                return { success: true, count: total.data().count };
            }

            // Sync from local public files (only if Firestore is empty)
            const newUsers: User[] = [];
            const fs = await import('fs/promises');
            const path = await import('path');

            // Rectores
            try {
                const rectoresPath = path.join(process.cwd(), 'public', 'data', 'rectores.xlsx');
                const fileBuffer = await fs.readFile(rectoresPath);
                const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(sheet) as any[];
                
                data.forEach(row => {
                    const email = String(row['EMAIL'] || '').trim();
                    if (!email) return;
                    newUsers.push({
                        email: email,
                        password: String(row['contraseña'] || '12345').trim(),
                        role: 'rector',
                        name: String(row['NOMBRE DEL RECTOR O DIRECTOR RURAL'] || ''),
                        municipality: String(row['MUNICIPIO'] || ''),
                        dane: String(row['DANE'] || ''),
                        institution: String(row['ESTABLECIMIENTO EDUCATIVO'] || ''),
                    });
                });
            } catch (e) { console.warn("Sync Rectores skipped:", e); }

            // Directores
            try {
                const directoresPath = path.join(process.cwd(), 'public', 'data', 'directoresDeNucleo.xlsx');
                const fileBuffer = await fs.readFile(directoresPath);
                const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(sheet) as any[];
                
                const directorMap = new Map<string, User>();
                data.forEach(row => {
                    const email = String(row['Correo electrónico'] || '').trim();
                    if (!email) return;
                    
                    if (!directorMap.has(email)) {
                        directorMap.set(email, {
                            email,
                            password: '012295',
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
            } catch (e) { console.warn("Sync Directores skipped:", e); }

            if (newUsers.length > 0) {
                const batch = db.batch();
                newUsers.forEach(u => {
                    const ref = db.collection(USERS_COLLECTION).doc(u.email.toLowerCase());
                    batch.set(ref, u);
                });
                await batch.commit();
                return { success: true, count: newUsers.length };
            }

            return { success: true, count: 0 };
        } catch (error: any) {
            return { success: false, count: 0, error: error.message };
        }
    }
);
