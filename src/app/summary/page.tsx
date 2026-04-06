'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft, Loader2, User, School, AlertTriangle, FileWarning, Save, LogOut } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { processReport, ProcessReportInput, ProcessReportOutput } from '@/ai/flows/process-report-flow';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


interface ReportItem {
  cedula: string;
  nombreCompleto: string;
  cargoActual?: string;
  fechaInicio?: string;
  fechaFinal?: string;
  fechaAusenciaUnDia?: string;
  horaInicio?: string;
  horaFinal?: string;
  fechaSolicitudPermiso?: string;
  fechaAutorizacionPermiso?: string;
  motivoPermiso?: string;
  observaciones?: string;
}

interface SubmissionData {
    reporterName: string;
    reporterPosition: string;
    municipality: string;
    month: string;
    daneNumber: string;
    institutionName: string;
    reports: ReportItem[];
}

function SummaryDisplay() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const [data, setData] = useState<SubmissionData | null>(null);
    const [status, setStatus] = useState<'checking' | 'conflict' | 'saving' | 'success' | 'error'>('checking');
    const [errorMessage, setErrorMessage] = useState('');
    const [showConflictDialog, setShowConflictDialog] = useState(false);

    useEffect(() => {
      const dataString = searchParams.get('data');
      if (!dataString) {
        setStatus('error');
        setErrorMessage('No se encontraron datos del reporte para procesar.');
        return;
      }
      const parsedData = JSON.parse(decodeURIComponent(dataString));
      setData(parsedData);
    }, [searchParams]);

    useEffect(() => {
      if (data) {
        const checkExistingReport = async () => {
          try {
            const checkInput: ProcessReportInput = {
              month: data.month,
              municipality: data.municipality,
              daneNumber: data.daneNumber,
              action: 'check',
            };
            const result = await processReport(checkInput);

            if (!result.success) throw new Error(result.error);

            if (result.reportExists) {
              setStatus('conflict');
              setShowConflictDialog(true);
            } else {
              // No conflict, proceed to save
              handleSave('append');
            }
          } catch (error: any) {
            setStatus('error');
            setErrorMessage(error.message || 'Error al verificar el reporte existente.');
            toast({ variant: 'destructive', title: 'Error de Verificación', description: error.message });
          }
        };

        checkExistingReport();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, toast]);
    
    const handleSave = async (action: 'overwrite' | 'append') => {
      if (!data) return;
      
      setStatus('saving');
      setShowConflictDialog(false);

      try {
        const saveInput: ProcessReportInput = {
          ...data,
          action,
        };
        const result = await processReport(saveInput);

        if (!result.success) throw new Error(result.error);

        setStatus('success');
        toast({ title: 'Éxito', description: `Reporte para ${data.institutionName} guardado correctamente.` });

      } catch (error: any) {
        setStatus('error');
        setErrorMessage(error.message || 'Ocurrió un error al guardar el reporte.');
        toast({ variant: 'destructive', title: 'Error al Guardar', description: error.message });
      }
    };
    
    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    const getMonthYear = (monthString: string) => {
        if (!monthString) return '';
        const [year, month] = monthString.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    }

    if (status === 'checking') {
      return (
        <div className="flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Verificando reportes existentes...</p>
            <p className="text-sm text-muted-foreground">Por favor espere un momento.</p>
        </div>
      );
    }
    
    if (status === 'saving') {
      return (
        <div className="flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Guardando el reporte en el servidor...</p>
            <p className="text-sm text-muted-foreground">Este proceso puede tardar unos segundos.</p>
        </div>
      );
    }

    if (status === 'error') {
      return (
          <Card className="w-full max-w-2xl shadow-2xl border-destructive">
            <CardHeader className="text-center items-center">
              <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
              <CardTitle className="text-3xl font-headline">Error al Procesar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">Ocurrió un error y no se pudo guardar su reporte.</p>
              <p className="text-center font-mono bg-muted p-2 my-4 rounded-md text-sm">{errorMessage}</p>
            </CardContent>
            <CardFooter>
              <Button onClick={() => router.back()} className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver e Intentar de Nuevo
              </Button>
            </CardFooter>
          </Card>
      );
    }
    
    if (status === 'conflict') {
      return (
        <AlertDialog open={showConflictDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center"><FileWarning className="mr-2 h-5 w-5 text-yellow-500"/>Reporte Existente Detectado</AlertDialogTitle>
              <AlertDialogDescription>
                Ya existe un reporte para la institución <span className="font-bold">{data?.institutionName}</span> en el mes de <span className="font-bold capitalize">{getMonthYear(data?.month || '')}</span>.
                ¿Qué desea hacer?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => handleSave('append')}>
                <Save className="mr-2"/>Anexar nuevos registros
              </Button>
              <Button variant="destructive" onClick={() => handleSave('overwrite')}>
                <FileWarning className="mr-2"/>Sobrescribir reporte completo
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    if (status === 'success' && data) {
      return (
          <Card className="w-full max-w-6xl shadow-2xl">
              <CardHeader className="text-center items-center">
                  <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                  <CardTitle className="text-3xl font-headline">Reporte Enviado y Guardado</CardTitle>
                  <CardDescription>A continuación se muestra un resumen de su envío.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 rounded-lg bg-muted/50">
                        <h3 className="font-semibold mb-2 flex items-center"><User className="mr-2 h-5 w-5 text-primary" />Información del Reportante</h3>
                        <div className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm pl-7">
                            <p><span className="font-medium text-muted-foreground">Nombre:</span> {data.reporterName}</p>
                            <p><span className="font-medium text-muted-foreground">Cargo:</span> {data.reporterPosition}</p>
                            <p><span className="font-medium text-muted-foreground">Municipio:</span> {data.municipality}</p>
                            <p><span className="font-medium text-muted-foreground">Mes:</span> <span className="capitalize">{getMonthYear(data.month)}</span></p>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                        <h3 className="font-semibold mb-2 flex items-center"><School className="mr-2 h-5 w-5 text-primary" />Información Establecimiento Educativo</h3>
                         <div className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm pl-7">
                            <p><span className="font-medium text-muted-foreground">Número DANE:</span> {data.daneNumber}</p>
                            <p><span className="font-medium text-muted-foreground">Nombre:</span> {data.institutionName}</p>
                        </div>
                    </div>
                  </div>

                  <div>
                      <h3 className="font-semibold mb-2">Detalle de Ausentismos Reportados ({data.reports.length})</h3>
                      <div className="w-full overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Cédula</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Cargo Actual</TableHead>
                                <TableHead>Fechas</TableHead>
                                <TableHead>Horas</TableHead>
                                <TableHead>Permiso</TableHead>
                                <TableHead>Motivo</TableHead>
                                <TableHead>Observaciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.reports.map((report, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{report.cedula}</TableCell>
                                  <TableCell>{report.nombreCompleto}</TableCell>
                                  <TableCell>{report.cargoActual}</TableCell>
                                  <TableCell className="text-xs">
                                    {report.fechaInicio && <p><strong>Inicio:</strong> {report.fechaInicio}</p>}
                                    {report.fechaFinal && <p><strong>Final:</strong> {report.fechaFinal}</p>}
                                    {report.fechaAusenciaUnDia && <p><strong>Ausencia:</strong> {report.fechaAusenciaUnDia}</p>}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {report.horaInicio && <p><strong>Inicio:</strong> {report.horaInicio}</p>}
                                    {report.horaFinal && <p><strong>Final:</strong> {report.horaFinal}</p>}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {report.fechaSolicitudPermiso && <p><strong>Solicitud:</strong> {report.fechaSolicitudPermiso}</p>}
                                    {report.fechaAutorizacionPermiso && <p><strong>Autorización:</strong> {report.fechaAutorizacionPermiso}</p>}
                                  </TableCell>
                                  <TableCell className="max-w-[150px] truncate">{report.motivoPermiso}</TableCell>
                                  <TableCell className="max-w-[200px] truncate">{report.observaciones}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                      </div>
                  </div>
              </CardContent>
              <CardFooter>
                  <Button onClick={handleLogout} className="w-full" size="lg">
                      <LogOut className="mr-2 h-4 w-4" />
                      Finalizar y Cerrar Sesión
                  </Button>
              </CardFooter>
          </Card>
      );
    }
    
    return null; // Render nothing while waiting or in an unhandled state
}

export default function SummaryPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <Suspense fallback={<div className="flex flex-col items-center justify-center text-center p-8"><Loader2 className="h-16 w-16 animate-spin text-primary" /><p className="mt-4">Cargando datos del reporte...</p></div>}>
                <SummaryDisplay />
            </Suspense>
        </main>
    );
}
