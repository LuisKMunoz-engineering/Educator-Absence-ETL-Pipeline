'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, Lock, ArrowLeft } from 'lucide-react';
import { getAppSettings, AppSettings } from '@/ai/flows/settings-flow';
import { Button } from '@/components/ui/button';

const ROLES_CONFIG = {
  rector: {
    allowedRoutes: ['/report', '/summary'],
    redirect: '/report',
    settingsKey: 'rectorEnabled' as keyof AppSettings,
  },
  director: {
    allowedRoutes: ['/verification', '/verification-summary'],
    redirect: '/verification',
    settingsKey: 'directorEnabled' as keyof AppSettings,
  },
  admin: {
    allowedRoutes: ['/downloads'],
    redirect: '/downloads',
    settingsKey: null,
  }
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
        const userRole = localStorage.getItem('userRole') as keyof typeof ROLES_CONFIG | null;

        if (!isAuthenticated || !userRole) {
          router.replace('/login');
          return;
        }

        const roleConfig = ROLES_CONFIG[userRole];

        // 1. Verificar si la ruta es permitida para el rol
        if (!roleConfig || !roleConfig.allowedRoutes.some(route => pathname.startsWith(route))) {
           router.replace(roleConfig.redirect);
           return;
        }

        // 2. Verificar Cronograma (Solo para Rector y Director)
        if (roleConfig.settingsKey) {
          const settings = await getAppSettings();
          const isEnabled = settings[roleConfig.settingsKey];
          
          if (!isEnabled) {
            setIsLocked(true);
            setIsChecking(false);
            return;
          }
        }

        setIsChecking(false);
      } catch (error) {
        console.error("Error en la verificación de seguridad:", error);
        router.replace('/login');
      }
    }

    checkAuth();
  }, [router, pathname]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6 p-8 rounded-xl border bg-card shadow-2xl">
          <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
            <Lock className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-primary">Cronograma Cerrado</h2>
            <p className="text-muted-foreground">
              Lo sentimos, el acceso para realizar reportes o verificaciones se encuentra deshabilitado temporalmente por la administración de la SED Cauca.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => {
              localStorage.clear();
              router.replace('/login');
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Inicio
          </Button>
          <p className="text-[10px] text-muted-foreground italic pt-4">
            Si considera que esto es un error, por favor contacte al soporte técnico.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
