'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Loader2 } from 'lucide-react';
import Image from 'next/image';
import * as XLSX from 'xlsx';

const ADMIN_PASSWORD = '12345';
const DIRECTOR_PASSWORD = '012295';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const lowerCaseEmail = email.trim().toLowerCase();

    try {
      // 1. Check Admin
      if (password === ADMIN_PASSWORD && lowerCaseEmail === 'admin') {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userRole', 'admin');
        router.push('/downloads');
        return;
      }

      // 2. Check Rector from rectores.xlsx
      try {
        const responseR = await fetch('/data/rectores.xlsx');
        if (responseR.ok) {
          const arrayBuffer = await responseR.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

          const rectorFound = jsonData.find(row => 
            String(row['EMAIL'] || '').toLowerCase() === lowerCaseEmail && 
            String(row['contraseña'] || '') === password
          );

          if (rectorFound) {
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('userRole', 'rector');
            localStorage.setItem('userName', String(rectorFound['NOMBRE DEL RECTOR O DIRECTOR RURAL'] || ''));
            localStorage.setItem('userMunicipality', String(rectorFound['MUNICIPIO'] || ''));
            localStorage.setItem('userDaneNumber', String(rectorFound['DANE'] || ''));
            localStorage.setItem('userInstitutionName', String(rectorFound['ESTABLECIMIENTO EDUCATIVO'] || ''));
            localStorage.setItem('userPosition', 'Rector / Director Rural');
            
            router.push('/report');
            return;
          }
        }
      } catch (e) {
        console.error("Error loading rectores.xlsx", e);
      }

      // 3. Check Director from directoresDeNucleo.xlsx
      if (password === DIRECTOR_PASSWORD) {
        try {
          const responseD = await fetch('/data/directoresDeNucleo.xlsx');
          if (responseD.ok) {
            const arrayBuffer = await responseD.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

            const directorRows = jsonData.filter(row => row['Correo electrónico']?.toLowerCase() === lowerCaseEmail);

            if (directorRows.length > 0) {
              const directorData = directorRows[0];
              const daneCodes = directorRows.map(row => String(row['CODIGO DANE']));
              
              localStorage.setItem('isAuthenticated', 'true');
              localStorage.setItem('userRole', 'director');
              localStorage.setItem('userName', directorData['NOMBRE'] || 'Director');
              localStorage.setItem('userCedula', String(directorData['IDENTIFICACIÓN'] || ''));
              localStorage.setItem('userDaneCodes', JSON.stringify(daneCodes));
              router.push('/verification');
              return;
            }
          }
        } catch (error) {
          console.error("Error al procesar archivo de directores:", error);
        }
      }

      toast({
        variant: 'destructive',
        title: 'Error de autenticación',
        description: 'Las credenciales no coinciden con nuestros registros.',
      });

    } catch (error) {
      console.error("Error durante el login:", error);
      toast({
        variant: 'destructive',
        title: 'Error de Sistema',
        description: 'No se pudo procesar el inicio de sesión.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl">
          <CardHeader className="text-center items-center">
            <Image src="/EscudoSedCaucaB.png" alt="Escudo SED Cauca" width={256} height={256} className="mb-4" />
            <CardTitle className="text-3xl font-headline">AppAusentismo</CardTitle>
            <CardDescription>Ingrese sus credenciales para continuar</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}