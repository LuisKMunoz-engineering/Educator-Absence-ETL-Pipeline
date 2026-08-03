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
    if (!email || !password) return;
    
    setIsLoading(true);

    try {
      const result = await login({ email, password });

      if (result.success && result.user) {
        // Almacenar datos de sesión localmente
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userRole', result.user.role);
        localStorage.setItem('userName', result.user.name);
        
        toast({
          title: "Inicio de sesión exitoso",
          description: `Bienvenido, ${result.user.name}`,
        });

        // Redirección basada en el rol
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
        title: 'Fallo al ingresar',
        description: result.error || 'Correo o contraseña incorrectos.',
      });

    } catch (error: any) {
      console.error("Error durante el login:", error);
      toast({
        variant: 'destructive',
        title: 'Error de Comunicación',
        description: 'No se pudo contactar con el servidor. Verifique su conexión.',
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
        <Card className="shadow-2xl border-t-4 border-t-primary">
          <CardHeader className="text-center items-center">
            <DynamicLogo width={180} height={180} className="mb-4" />
            <CardTitle className="text-3xl font-bold text-primary">AppAusentismo</CardTitle>
            <CardDescription>Gestión de Reportes SED-CAUCA</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Usuario / Correo</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="admin o rector@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="username"
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
                    autoComplete="current-password"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Ingresar al Sistema
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground italic">
          Secretaría de Educación del Cauca - Oficina de Sistemas
        </p>
      </div>
    </main>
  );
}
