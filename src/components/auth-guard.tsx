'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const ROLES_CONFIG = {
  rector: {
    allowedRoutes: ['/report', '/summary'],
    redirect: '/report',
  },
  director: {
    allowedRoutes: ['/verification', '/verification-summary'],
    redirect: '/verification',
  },
  admin: {
    allowedRoutes: ['/downloads'],
    redirect: '/downloads',
  }
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    try {
      const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
      const userRole = localStorage.getItem('userRole') as keyof typeof ROLES_CONFIG | null;

      if (!isAuthenticated || !userRole) {
        router.replace('/login');
        return;
      }

      const roleConfig = ROLES_CONFIG[userRole];

      if (!roleConfig || !roleConfig.allowedRoutes.some(route => pathname.startsWith(route))) {
         // If user tries to access a page not allowed for their role, redirect them.
         router.replace(roleConfig.redirect);
      } else {
        setIsChecking(false);
      }

    } catch (error) {
      console.error("Could not access localStorage, redirecting to login.", error);
      router.replace('/login');
    }
  }, [router, pathname]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
