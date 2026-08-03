'use server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

export async function getUsers() {
    const usersPath = path.join(process.cwd(), 'storage', 'users.json');
    try {
        const data = await fs.readFile(usersPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

export async function saveUser(user: any) {
    const usersPath = path.join(process.cwd(), 'storage', 'users.json');
    const users = await getUsers();
    const existingIndex = users.findIndex((u: any) => u.email === user.email);
    if (existingIndex > -1) users[existingIndex] = user;
    else users.push(user);
    await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
    return { success: true };
}

export async function deleteUser(email: string) {
    const usersPath = path.join(process.cwd(), 'storage', 'users.json');
    const users = await getUsers();
    const filtered = users.filter((u: any) => u.email !== email);
    await fs.writeFile(usersPath, JSON.stringify(filtered, null, 2));
    return { success: true };
}
