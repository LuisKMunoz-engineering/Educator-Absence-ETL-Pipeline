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
        const rectoresPath = path.join(process.cwd(), 'public', 'data', 'rectores.xlsx');
        const directoresPath = path.join(process.cwd(), 'public', 'data', 'directoresDeNucleo.xlsx');
        
        let newUsers: User[] = [];
        let count = 0;

        // Sincronizar Rectores
        try {
            const bufR = await fs.readFile(rectoresPath);
            const wbR = XLSX.read(bufR, { type: 'buffer' });
            const dataR = XLSX.utils.sheet_to_json(wbR.Sheets[wbR.SheetNames[0]]) as any[];
            
            for (const row of dataR) {
                const email = (row['Email'] || row['EMAIL'] || row['CORREO'] || row['CORREO INSTITUCIONAL'] || '').toString().trim().toLowerCase();
                if (!email) continue;
                
                newUsers.push({
                    email,
                    password: (row['Contraseña'] || row['PASSWORD'] || row['CONTRASEÑA'] || '123').toString(),
                    role: 'rector',
                    name: (row['Nombre'] || row['NOMBRE'] || row['NOMBRE COMPLETO'] || 'Rector').toString(),
                    cedula: (row['Cédula'] || row['CEDULA'] || '').toString(),
                    dane: (row['DANE'] || row['CODIGO DANE'] || '').toString(),
                    municipality: (row['Municipio'] || row['MUNICIPIO'] || '').toString(),
                    institution: (row['Institución'] || row['ESTABLECIMIENTO EDUCATIVO'] || row['INSTITUCION'] || '').toString(),
                });
                count++;
            }
        } catch (e) {
            console.warn("Archivo de rectores no encontrado o con error en su lectura.");
        }

        // Sincronizar Directores
        try {
            const bufD = await fs.readFile(directoresPath);
            const wbD = XLSX.read(bufD, { type: 'buffer' });
            const dataD = XLSX.utils.sheet_to_json(wbD.Sheets[wbD.SheetNames[0]]) as any[];
            
            for (const row of dataD) {
                const email = (row['Email'] || row['EMAIL'] || row['CORREO'] || row['CORREO INSTITUCIONAL'] || '').toString().trim().toLowerCase();
                if (!email) continue;
                
                const daneCodesRaw = (row['DANE Asignados'] || row['DANES'] || row['CODIGOS DANE'] || row['DANE'] || '').toString();
                const daneCodes = daneCodesRaw.split(',').map((c: string) => c.trim()).filter((c: string) => !!c);

                newUsers.push({
                    email,
                    password: (row['Contraseña'] || row['PASSWORD'] || row['CONTRASEÑA'] || '123').toString(),
                    role: 'director',
                    name: (row['Nombre'] || row['NOMBRE'] || row['NOMBRE COMPLETO'] || 'Director').toString(),
                    cedula: (row['Cédula'] || row['CEDULA'] || '').toString(),
                    daneCodes: daneCodes
                });
                count++;
            }
        } catch (e) {
            console.warn("Archivo de directores no encontrado o con error en su lectura.");
        }

        if (count > 0) {
            const currentUsers = await getUsers();
            // Preservar administradores actuales que no colisionen con los nuevos correos
            const newEmails = new Set(newUsers.map(u => u.email));
            const admins = currentUsers.filter(u => u.role === 'admin' && !newEmails.has(u.email.toLowerCase()));

            await fs.writeFile(USERS_PATH, JSON.stringify([...admins, ...newUsers], null, 2));
        }

        return { success: true, count };
    } catch (error: any) {
        console.error("Sync error:", error);
        return { success: false, error: error.message };
    }
}
