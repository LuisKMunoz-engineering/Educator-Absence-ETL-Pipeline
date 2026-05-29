'use client';

import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogOut, ArrowLeft, ExternalLink, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

export default function SoportesPage() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const handleBack = () => {
    router.push('/verification');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="p-4 flex justify-between items-center bg-card border-b sticky top-0 z-10 h-24">
        <div className="flex items-center">
          <Image src="/EscudoSedCaucaB.png" alt="Escudo SED Cauca" width={80} height={80} />
        </div>
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-3xl mx-auto flex items-center justify-center min-h-[calc(100vh-120px)]">
        <Card className="shadow-xl border-t-4 border-t-primary">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <FileUp className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary font-headline">Carga de Soportes de Ausentismo</CardTitle>
            <CardDescription className="text-base mt-4 text-balance">
              A continuación deberá cargar los soportes del reporte de ausentismo consolidados de acuerdo a lo dispuesto por la SED-CAUCA para tal fin, por favor ingrese al siguiente enlace:
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-8">
            <a 
              href="https://docs.google.com/forms/d/e/1FAIpQLSd80VsgwyxhGDlmdAhGH3pHJIIXiCTuUoJkpGaW0Cgp78zV3A/viewform?usp=sharing&ouid=111163340323659404633" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full"
            >
                <Button size="lg" className="w-full h-16 text-lg font-semibold gap-3 animate-pulse hover:animate-none">
                    <ExternalLink className="h-6 w-6" />
                    Ir al Formulario de Google (Soportes)
                </Button>
            </a>
          </CardContent>
          <CardFooter className="flex justify-between border-t bg-muted/20 p-6">
            <Button variant="outline" onClick={handleBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver a Verificación
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
