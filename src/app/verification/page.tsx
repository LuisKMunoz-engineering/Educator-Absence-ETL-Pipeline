'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Send, LogOut, Loader2, Upload, FileWarning, ClipboardCheck, ExternalLink } from "lucide-react";
import Image from "next/image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getReportsForVerification, GetReportsForVerificationInput } from "@/ai/flows/get-reports-for-verification-flow";
import { verifyReports, VerifyReportsInput } from "@/ai/flows/verify-reports-flow";
import { rejectReport, RejectReportInput } from "@/ai/flows/reject-report-flow";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

const reportItemSchema = z.object({
  'DANE ESTABLECIMIENTO EDUCATIVO': z.string(),
  'ESTABLECIMIENTO EDUCATIVO': z.string(),
  'Cédula': z.string(),
  'Nombre Completo': z.string(),
  'Cargo Actual': z.string().optional(),
  'Fecha Inicio': z.string().optional(),
  'Fecha Final': z.string().optional(),
  'Fecha Ausencia menos de un día': z.string().optional(),
  'Hora Inicio': z.string().optional(),
  'Hora Final': z.string().optional(),
  'Fecha Solicitud Permiso': z.string().optional(),
  'Fecha Autorización Permiso': z.string().optional(),
  'Motivo de Permiso': z.string().optional(),
  'Observaciones': z.string().optional(),
  'Verificado': z.string().optional(),
  'Estado del Reporte': z.string().optional(),
});

type ReportItem = z.infer<typeof reportItemSchema>;

const formSchema = z.object({
  reporterName: z.string(),
  reporterCedula: z.string(),
  reporterPosition: z.string(),
  month: z.string().min(1, "El mes es requerido."),
});

type FormValues = z.infer<typeof formSchema>;

interface GroupedReport {
  institutionName: string;
  daneCode: string;
  isFullyVerified: boolean;
  status: string;
  reports: ReportItem[];
}

export default function VerificationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [directorName, setDirectorName] = useState('');
  const [directorCedula, setDirectorCedula] = useState('');
  const [daneCodes, setDaneCodes] = useState<string[]>([]);
  const [groupedReports, setGroupedReports] = useState<GroupedReport[]>([]);
  const [allReports, setAllReports] = useState<ReportItem[]>([]);
  const [verifiedStatus, setVerifiedStatus] = useState<Record<string, boolean>>({});
  const [isRejectionLoading, setIsRejectionLoading] = useState<string | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<{ daneCode: string, institutionName: string } | null>(null);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(true);

  useEffect(() => {
    const name = localStorage.getItem('userName') || 'Director de Núcleo';
    const cedula = localStorage.getItem('userCedula') || '';
    const codes = JSON.parse(localStorage.getItem('userDaneCodes') || '[]');
    setDirectorName(name);
    setDirectorCedula(cedula);
    setDaneCodes(codes);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reporterName: directorName,
      reporterCedula: directorCedula,
      reporterPosition: "Director de Núcleo",
      month: "",
    },
    mode: 'onChange'
  });

  useEffect(() => {
    form.setValue('reporterName', directorName);
    form.setValue('reporterCedula', directorCedula);
  }, [directorName, directorCedula, form]);
  
  const isSubmitting = form.formState.isSubmitting;
  
  const newlyVerifiedCount = Object.keys(verifiedStatus).filter(
    (dane) => verifiedStatus[dane] && !groupedReports.find(g => g.daneCode === dane)?.isFullyVerified
  ).length;

  const canSubmit = form.formState.isValid && allReports.length > 0 && newlyVerifiedCount > 0;

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  }
  
  const handleVerificationChange = (daneCode: string, isChecked: boolean | 'indeterminate') => {
    if (typeof isChecked === 'boolean') {
      setVerifiedStatus(prev => ({
        ...prev,
        [daneCode]: isChecked,
      }));
    }
  };

  const handleReject = async () => {
    if (!rejectionTarget) return;

    const month = form.getValues("month");
    if (!month) {
        toast({ variant: "destructive", title: "Error", description: "El mes del reporte no está seleccionado." });
        setRejectionTarget(null);
        return;
    }

    setIsRejectionLoading(rejectionTarget.daneCode);

    try {
        const input: RejectReportInput = {
            month: month,
            daneCode: rejectionTarget.daneCode,
        };

        const result = await rejectReport(input);

        if (!result.success) {
            throw new Error(result.error || "No se pudo rechazar el reporte.");
        }

        toast({
            title: "Reporte Rechazado",
            description: `El reporte de ${rejectionTarget.institutionName} fue marcado para corrección.`,
        });

        await handleLoadReports();

    } catch (error: any) {
        toast({ variant: "destructive", title: "Error al Rechazar", description: error.message });
    } finally {
        setIsRejectionLoading(null);
        setRejectionTarget(null);
    }
  };

  const handleLoadReports = async () => {
    const month = form.getValues("month");
    if (!month) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor seleccione el mes del reporte a verificar.",
      });
      return;
    }
    if (daneCodes.length === 0) {
      toast({
        variant: "destructive",
        title: "Error de configuración",
        description: "No se encontraron códigos DANE para este director.",
      });
      return;
    }
    
    setIsLoading(true);
    setAllReports([]);
    setGroupedReports([]);
    setVerifiedStatus({});

    try {
      const input: GetReportsForVerificationInput = {
        daneCodes: daneCodes,
        month: month
      };

      const result = await getReportsForVerification(input);

      if (result.success && result.reports) {
        if (result.reports.length === 0) {
           toast({
              title: "Sin resultados",
              description: result.message || "No se encontraron reportes para los establecimientos y el mes seleccionado.",
          });
          setIsLoading(false);
          return;
        }
        
        const fullyVerifiedDaneCodes = new Set(result.fullyVerifiedDaneCodes || []);
        const initialVerifiedStatus: Record<string, boolean> = {};

        const groups: { [key: string]: GroupedReport } = {};
        result.reports.forEach(report => {
          const dane = report['DANE ESTABLECIMIENTO EDUCATIVO'].toString();
          if (!groups[dane]) {
            const isFullyVerified = fullyVerifiedDaneCodes.has(dane);
            const status = report['Estado del Reporte'] || 'Enviado';
            groups[dane] = {
              daneCode: dane,
              institutionName: report['ESTABLECIMIENTO EDUCATIVO'],
              isFullyVerified: isFullyVerified,
              status: status,
              reports: []
            };
            if (isFullyVerified) {
              initialVerifiedStatus[dane] = true;
            }
          }
          groups[dane].reports.push(report);
        });

        setGroupedReports(Object.values(groups));
        setVerifiedStatus(initialVerifiedStatus);
        setAllReports(result.reports);

        toast({
          title: "Éxito",
          description: `Se cargaron ${result.reports.length} reportes para verificación.`,
        });

      } else {
        throw new Error(result.error || "Ocurrió un error al cargar los reportes.");
      }
    } catch(error: any) {
       toast({
          variant: "destructive",
          title: "Error al Cargar Reportes",
          description: error.message || "No se pudieron obtener los reportes desde el servidor.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(data: FormValues) {
    const verifiedDaneCodes = Object.keys(verifiedStatus).filter(
      (daneCode) => verifiedStatus[daneCode]
    );

    const newlyVerifiedDaneCodes = verifiedDaneCodes.filter(
        dane => !groupedReports.find(g => g.daneCode === dane)?.isFullyVerified
    );


    if (newlyVerifiedDaneCodes.length === 0) {
      toast({
        variant: "destructive",
        title: "Sin Selección",
        description: "Debe marcar como verificado al menos un reporte nuevo o actualizado para poder enviar.",
      });
      return;
    }

    try {
      const input: VerifyReportsInput = {
        month: data.month,
        verifiedDaneCodes: newlyVerifiedDaneCodes,
      };

      const result = await verifyReports(input);

      if (!result.success) {
        throw new Error(result.error || "Ocurrió un error desconocido al guardar la verificación.");
      }
      
      const verifiedInstitutions = groupedReports
        .filter(g => newlyVerifiedDaneCodes.includes(g.daneCode))
        .map(g => ({ name: g.institutionName, dane: g.daneCode }));

      const summaryData = {
        directorName: data.reporterName,
        month: data.month,
        verifiedInstitutions: verifiedInstitutions,
      };

      const query = encodeURIComponent(JSON.stringify(summaryData));
      router.push(`/verification-summary?data=${query}`);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al Enviar",
        description: error.message,
      });
    }
  }

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

        <main className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="flex flex-col items-center justify-center mb-6">
              <h1 className="text-3xl font-bold text-primary font-headline mt-2">Página de Verificación</h1>
            </div>
            
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                <CardHeader>
                    <CardTitle>Información del Reportante</CardTitle>
                    <CardDescription>Datos del Director de Núcleo que realiza la verificación.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="reporterName" render={({ field }) => (
                        <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input {...field} readOnly className="bg-muted/20"/></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="reporterCedula" render={({ field }) => (
                        <FormItem><FormLabel>Cédula / No. Identificación</FormLabel><FormControl><Input {...field} readOnly className="bg-muted/20"/></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="reporterPosition" render={({ field }) => (
                        <FormItem><FormLabel>Cargo</FormLabel><FormControl><Input {...field} readOnly className="bg-muted/20"/></FormControl><FormMessage /></FormItem>
                    )} />
                </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Elección del Mes de Reporte:</CardTitle>
                        <CardDescription>Ingrese el mes de reporte que usted como Director de Núcleo va a verificar y reportar.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-end gap-4">
                        <FormField control={form.control} name="month" render={({ field }) => (
                            <FormItem className="flex-grow"><FormLabel>Mes del Reporte a Verificar</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="button" onClick={handleLoadReports} disabled={isLoading}>
                          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                          {isLoading ? 'Cargando...' : 'Cargar'}
                        </Button>
                      </div>
                    </CardContent>
                </Card>
                
                <Card className="bg-blue-50/10 dark:bg-blue-900/10">
                    <CardHeader>
                      <CardTitle>Reportes a Verificar:</CardTitle>
                      <CardDescription>Esta sección es de sólo lectura. Use las casillas para marcar un reporte como verificado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {groupedReports.length > 0 ? (
                        <Accordion type="multiple" className="w-full">
                          {groupedReports.map((group, groupIndex) => (
                            <AccordionItem value={`item-${groupIndex}`} key={group.daneCode}>
                              <AccordionTrigger>
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex flex-col text-left">
                                        <span className="font-semibold">{group.institutionName}</span>
                                        <span className="text-sm text-muted-foreground">DANE: {group.daneCode}</span>
                                    </div>
                                    <Badge 
                                      variant={
                                        group.status === 'Rechazado para corrección' ? 'destructive' :
                                        group.status === 'Verificado' ? 'default' : 'secondary'
                                      } 
                                      className="ml-4"
                                    >
                                      {group.status}
                                    </Badge>
                                    <div className="flex items-center space-x-2 mr-4" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            id={`verif-${group.daneCode}`}
                                            checked={verifiedStatus[group.daneCode] || false}
                                            onCheckedChange={(checked) => handleVerificationChange(group.daneCode, checked)}
                                            disabled={group.isFullyVerified}
                                        />
                                        <label htmlFor={`verif-${group.daneCode}`} className={`text-sm font-medium leading-none ${group.isFullyVerified ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}>
                                            {group.isFullyVerified ? 'Verificado' : 'Reporte Verificado'}
                                        </label>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRejectionTarget({ daneCode: group.daneCode, institutionName: group.institutionName });
                                            }}
                                            disabled={isRejectionLoading === group.daneCode}
                                        >
                                            {isRejectionLoading === group.daneCode ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileWarning className="h-4 w-4"/>}
                                            <span className="ml-2 hidden sm:inline">Rechazar</span>
                                        </Button>
                                    </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="w-full overflow-x-auto">
                                    <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Cédula</TableHead>
                                            <TableHead>Nombre Completo</TableHead>
                                            <TableHead>Cargo Actual</TableHead>
                                            <TableHead>Fecha Inicio</TableHead>
                                            <TableHead>Fecha Final</TableHead>
                                            <TableHead>Fecha Ausencia &lt; 1 día</TableHead>
                                            <TableHead>Hora Inicio</TableHead>
                                            <TableHead>Hora Final</TableHead>
                                            <TableHead>Fecha Solicitud</TableHead>
                                            <TableHead>Fecha Autorización</TableHead>
                                            <TableHead>Motivo</TableHead>
                                            <TableHead>Observaciones</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Verificado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {group.reports.map((report, reportIndex) => (
                                            <TableRow key={`${group.daneCode}-${reportIndex}`}>
                                                <TableCell className="font-medium">
                                                    <div className="w-28 whitespace-nowrap">{report['Cédula']}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="w-60 whitespace-nowrap">{report['Nombre Completo']}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="w-60 whitespace-nowrap">{report['Cargo Actual']}</div>
                                                </TableCell>
                                                <TableCell><div className="w-28 whitespace-nowrap">{report['Fecha Inicio'] || ''}</div></TableCell>
                                                <TableCell><div className="w-28 whitespace-nowrap">{report['Fecha Final'] || ''}</div></TableCell>
                                                <TableCell><div className="w-36 whitespace-nowrap">{report['Fecha Ausencia menos de un día'] || ''}</div></TableCell>
                                                <TableCell><div className="w-24 whitespace-nowrap">{report['Hora Inicio'] || ''}</div></TableCell>
                                                <TableCell><div className="w-24 whitespace-nowrap">{report['Hora Final'] || ''}</div></TableCell>
                                                <TableCell><div className="w-28 whitespace-nowrap">{report['Fecha Solicitud Permiso'] || ''}</div></TableCell>
                                                <TableCell><div className="w-32 whitespace-nowrap">{report['Fecha Autorización Permiso'] || ''}</div></TableCell>
                                                <TableCell><div className="w-40 whitespace-nowrap">{report['Motivo de Permiso'] || ''}</div></TableCell>
                                                <TableCell><div className="w-60 whitespace-nowrap truncate">{report['Observaciones'] || ''}</div></TableCell>
                                                <TableCell><div className="w-40 whitespace-nowrap">{report['Estado del Reporte'] || 'Enviado'}</div></TableCell>
                                                <TableCell><div className="w-44 whitespace-nowrap">{report['Verificado'] || 'Pendiente'}</div></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    </Table>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      ) : (
                         <p className="text-sm text-muted-foreground mt-4 text-center">
                            Seleccione un mes y haga clic en 'Cargar' para ver los reportes pendientes de verificación.
                         </p>
                      )}
                    </CardContent>
                </Card>

                <Separator />

                <div className="flex justify-end items-center">
                    <Button type="submit" size="lg" disabled={!canSubmit || isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                        {isSubmitting ? 'Enviando...' : 'Enviar Verificación'}
                    </Button>
                </div>
            </form>
            </Form>

            {/* Welcome Dialog */}
            <AlertDialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
                    <ClipboardCheck className="h-6 w-6" />
                    Bienvenido, Señor Director
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-base py-4">
                    ¿Qué acción va a realizar en este momento?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-col sm:flex-col gap-3">
                  <Button 
                    className="w-full justify-start py-6 text-base" 
                    onClick={() => setShowWelcomeDialog(false)}
                  >
                    <ClipboardCheck className="mr-3 h-5 w-5" />
                    Verificar reportes enviados por las Instituciones Educativas
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start py-6 text-base border-primary text-primary hover:bg-primary/10"
                    onClick={() => router.push('/verification/soportes')}
                  >
                    <ExternalLink className="mr-3 h-5 w-5" />
                    Realizar reporte de Ausentismo ante la SED-CAUCA
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

             <AlertDialog open={!!rejectionTarget} onOpenChange={(open) => !open && setRejectionTarget(null)}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>¿Confirmar Rechazo?</AlertDialogTitle>
                      <AlertDialogDescription>
                          Esta acción marcará el reporte de <span className="font-bold">{rejectionTarget?.institutionName}</span> como "Rechazado para corrección" y permitirá al rector enviar una nueva versión. El estado de verificación actual se anulará. ¿Desea continuar?
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReject} className={buttonVariants({ variant: "destructive" })}>
                          Sí, Rechazar Reporte
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
        </main>
    </div>
  );
}
