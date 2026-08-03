'use server';
/**
 * @fileOverview Flow to manage users using local JSON storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import * as XLSX from 'xlsx';

export interface User {
    email: string;
    password: string;
    role: 'rector' | 'director' | 'admin';
    name: string;
    municipality?: string;
    dane?: string;
    institution?: string;
    cedula?: string;
    daneCodes?: string[];
}

const USERS_PATH = path.join(process.cwd(), 'storage', 'users.json');

async function ensureStorageDir() {
    const storageDir = path.join(process.cwd(), 'storage');
    await fs.mkdir(storageDir, { recursive: true });
}

export async function getUsers(): Promise<User[]> {
    try {
        await ensureStorageDir();
        const data = await fs.readFile(USERS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

export async function saveUser(user: User) {
    await ensureStorageDir();
    const users = await getUsers();
    const existingIndex = users.findIndex((u: User) => u.email.toLowerCase() === user.email.toLowerCase());
    
    if (existingIndex > -1) {
        users[existingIndex] = user;
    } else {
        users.push(user);
    }
    
    await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2));
    return { success: true };
}

export async function deleteUser(email: string) {
    const users = await getUsers();
    const filtered = users.filter((u: User) => u.email.toLowerCase() !== email.toLowerCase());
    await fs.writeFile(USERS_PATH, JSON.stringify(filtered, null, 2));
    return { success: true };
}

export async function syncFromExcel() {
    try {
        const excelPath = path.join(process.cwd(), 'public', 'data', 'plantaActual.xlsx');
        const fileBuffer = await fs.readFile(excelPath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        const currentUsers = await getUsers();
        const uniqueDanes = Array.from(new Set(jsonData.map(row => String(row['CODIGO DANE']))));
        
        let count = 0;
        for (const dane of uniqueDanes) {
            const row = jsonData.find(r => String(r['CODIGO DANE']) === dane);
            const email = `rector${dane}@sedcauca.gov.co`.toLowerCase();
            
            if (!currentUsers.find(u => u.email.toLowerCase() === email)) {
                await saveUser({
                    email,
                    password: '123',
                    role: 'rector',
                    name: `Rector ${row['ESTABLECIMIENTO EDUCATIVO']}`,
                    municipality: row['MUNICIPIO'],
                    dane: dane,
                    institution: row['ESTABLECIMIENTO EDUCATIVO']
                });
                count++;
            }
        }

        return { success: true, count };
    } catch (error: any) {
        console.error("Sync error:", error);
        return { success: false, error: error.message };
    }
}
