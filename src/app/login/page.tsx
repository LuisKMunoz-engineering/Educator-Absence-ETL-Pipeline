'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Loader2 } from 'lucide-react';
import { login } from '@/ai/flows/login-flow';
import { DynamicLogo } from '@/components/dynamic-logo';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login({ email, password });

      if (result.success && result.user) {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userRole', result.user.role);
        localStorage.setItem('userName', result.user.name);
        
        if (result.user.role === 'admin') {
          router.push('/downloads');
        } else if (result.user.role === 'rector') {
          localStorage.setItem('userMunicipality', result.user.municipality || '');
          localStorage.setItem('userDaneNumber', result.user.dane || '');
          localStorage.setItem('userInstitutionName', result.user.institution || '');
          localStorage.setItem('userPosition', 'Rector / Director Rural');
          router.push('/report');
        } else if (result.user.role === 'director') {
          localStorage.setItem('userCedula', result.user.cedula || '');
          localStorage.setItem('userDaneCodes', JSON.stringify(result.user.daneCodes || []));
          router.push('/verification');
        }
        return;
      }

      toast({
        variant: 'destructive',
        title: 'Error de autenticación',
        description: result.error || 'Correo o contraseña incorrectos.',
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
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <Card className="shadow-2xl">
          <CardHeader className="text-center items-center">
            <DynamicLogo width={200} height={200} className="mb-4" />
            <CardTitle className="text-3xl font-headline text-primary">AppAusentismo</CardTitle>
            <CardDescription>Ingrese sus credenciales para continuar</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="text"
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
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                {isLoading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}