'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, User, School, LogOut, ListChecks, ArrowLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface VerifiedInstitution {
  name: string;
  dane: string;
}

interface SummaryData {
    directorName: string;
    month: string;
    verifiedInstitutions: VerifiedInstitution[];
}

function VerificationSummaryDisplay() {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const [data, setData] = useState<SummaryData | null>(null);

    useEffect(() => {
      const dataString = searchParams.get('data');
      if (dataString) {
        const parsedData = JSON.parse(decodeURIComponent(dataString));
        setData(parsedData);
      }
    }, [searchParams]);

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    const handleBackToVerification = () => {
        router.push('/verification');
    };

    const getMonthYear = (monthString: string) => {
        if (!monthString) return '';
        const [year, month] = monthString.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    }

    if (!data) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Cargando resumen de la verificación...</p>
        </div>
      );
    }

    return (
        <Card className="w-full max-w-4xl shadow-2xl">
            <CardHeader className="text-center items-center">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <CardTitle className="text-3xl font-headline">Verificación Enviada con Éxito</CardTitle>
                <CardDescription>A continuación se muestra un resumen de su verificación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
                <div className="p-4 rounded-lg bg-muted/50">
                    <h3 className="font-semibold mb-2 flex items-center"><User className="mr-2 h-5 w-5 text-primary" />Información del Director de Núcleo o Reportante:</h3>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm pl-7">
                        <p><span className="font-medium text-muted-foreground">Nombre:</span> {data.directorName}</p>
                        <p><span className="font-medium text-muted-foreground">Mes Verificado:</span> <span className="capitalize">{getMonthYear(data.month)}</span></p>
                    </div>
                </div>

                <div>
                    <h3 className="font-semibold mb-2 flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary" />Instituciones Educativas Verificadas ({data.verifiedInstitutions.length})</h3>
                    <div className="w-full overflow-x-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nombre Establecimiento Educativo</TableHead>
                              <TableHead>Código DANE</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.verifiedInstitutions.map((inst, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{inst.name}</TableCell>
                                <TableCell>{inst.dane}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-4">
                <Button onClick={handleBackToVerification} variant="outline" className="w-full" size="lg">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Verificar Otros Reportes
                </Button>
                <Button onClick={handleLogout} className="w-full" size="lg">
                    <LogOut className="mr-2 h-4 w-4" />
                    Finalizar y Cerrar Sesión
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function VerificationSummaryPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <Suspense fallback={<div className="flex flex-col items-center justify-center text-center p-8"><Loader2 className="h-16 w-16 animate-spin text-primary" /><p className="mt-4">Cargando resumen...</p></div>}>
                <VerificationSummaryDisplay />
            </Suspense>
        </main>
    );
}