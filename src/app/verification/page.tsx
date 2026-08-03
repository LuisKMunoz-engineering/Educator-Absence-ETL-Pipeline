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
import { DynamicLogo } from "@/components/dynamic-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
  const [rejectionObservation, setRejectionObservation] = useState('');
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
    if (!rejectionTarget || !rejectionObservation.trim()) {
        toast({ variant: "destructive", title: "Error", description: "Debe ingresar un motivo de rechazo." });
        return;
    }

    const month = form.getValues("month");
    setIsRejectionLoading(rejectionTarget.daneCode);

    try {
        const input: RejectReportInput = {
            month: month,
            daneCode: rejectionTarget.daneCode,
            observation: rejectionObservation.trim(),
        };

        const result = await rejectReport(input);
        if (!result.success) throw new Error(result.error);

        toast({ title: "Reporte Rechazado", description: `Se ha enviado la observación al Rector.` });
        setRejectionObservation('');
        await handleLoadReports();
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
        setIsRejectionLoading(null);
        setRejectionTarget(null);
    }
  };

  const handleLoadReports = async () => {
    const month = form.getValues("month");
    if (!month) {
      toast({ variant: "destructive", title: "Error", description: "Seleccione el mes." });
      return;
    }
    setIsLoading(true);
    setAllReports([]);
    setGroupedReports([]);
    setVerifiedStatus({});

    try {
      const result = await getReportsForVerification({ daneCodes, month });
      if (result.success && result.reports) {
        if (result.reports.length === 0) {
           toast({ title: "Sin resultados", description: "No hay reportes para este mes." });
           setIsLoading(false);
           return;
        }
        const fullyVerifiedDaneCodes = new Set(result.fullyVerifiedDaneCodes || []);
        const groups: { [key: string]: GroupedReport } = {};
        result.reports.forEach(report => {
          const dane = report['DANE ESTABLECIMIENTO EDUCATIVO'].toString();
          if (!groups[dane]) {
            const isFullyVerified = fullyVerifiedDaneCodes.has(dane);
            groups[dane] = {
              daneCode: dane,
              institutionName: report['ESTABLECIMIENTO EDUCATIVO'],
              isFullyVerified,
              status: report['Estado del Reporte'] || 'Enviado',
              reports: []
            };
          }
          groups[dane].reports.push(report);
        });
        setGroupedReports(Object.values(groups));
        setAllReports(result.reports);
      }
    } catch(error: any) {
       toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(data: FormValues) {
    const newlyVerifiedDaneCodes = Object.keys(verifiedStatus).filter(
      dane => verifiedStatus[dane] && !groupedReports.find(g => g.daneCode === dane)?.isFullyVerified
    );
    if (newlyVerifiedDaneCodes.length === 0) {
      toast({ variant: "destructive", title: "Sin Selección", description: "Debe marcar algún reporte nuevo como verificado." });
      return;
    }
    try {
      const result = await verifyReports({ month: data.month, verifiedDaneCodes: newlyVerifiedDaneCodes });
      if (!result.success) throw new Error(result.error);
      const verifiedInsts = groupedReports.filter(g => newlyVerifiedDaneCodes.includes(g.daneCode)).map(g => ({ name: g.institutionName, dane: g.daneCode }));
      router.push(`/verification-summary?data=${encodeURIComponent(JSON.stringify({ directorName: data.reporterName, month: data.month, verifiedInstitutions: verifiedInsts }))}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="p-4 flex justify-between items-center bg-card border-b sticky top-0 z-10 h-24">
        <div className="flex items-center"><DynamicLogo width={80} height={80} /></div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Cerrar Sesión</Button>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center mb-6">
          <h1 className="text-3xl font-bold text-primary font-headline mt-2">Página de Verificación</h1>
        </div>
        
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Información del Reportante</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-6">
                <FormField control={form.control} name="reporterName" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><Input {...field} readOnly className="bg-muted/20"/></FormItem>)} />
                <FormField control={form.control} name="reporterCedula" render={({ field }) => (<FormItem><FormLabel>Cédula</FormLabel><Input {...field} readOnly className="bg-muted/20"/></FormItem>)} />
                <FormField control={form.control} name="reporterPosition" render={({ field }) => (<FormItem><FormLabel>Cargo</FormLabel><Input {...field} readOnly className="bg-muted/20"/></FormItem>)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Elección del Mes</CardTitle></CardHeader>
              <CardContent className="flex items-end gap-4">
                <FormField control={form.control} name="month" render={({ field }) => (<FormItem className="flex-grow"><FormLabel>Mes</FormLabel><Input type="month" {...field} /></FormItem>)} />
                <Button type="button" onClick={handleLoadReports} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                  Cargar
                </Button>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-50/10 dark:bg-blue-900/10">
              <CardHeader><CardTitle>Reportes a Verificar</CardTitle></CardHeader>
              <CardContent>
                {groupedReports.length > 0 ? (
                  <Accordion type="multiple" className="w-full">
                    {groupedReports.map((group, idx) => (
                      <AccordionItem value={`item-${idx}`} key={group.daneCode}>
                        <AccordionTrigger>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col text-left">
                              <span className="font-semibold">{group.institutionName}</span>
                              <span className="text-sm text-muted-foreground">DANE: {group.daneCode}</span>
                            </div>
                            <div className="flex items-center space-x-3 mr-4" onClick={(e) => e.stopPropagation()}>
                              <Badge variant={group.status === 'Rechazado para corrección' ? 'destructive' : group.status === 'Verificado' ? 'default' : 'secondary'}>
                                {group.status}
                              </Badge>
                              
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`verif-${group.daneCode}`}
                                  checked={verifiedStatus[group.daneCode] || false} 
                                  onCheckedChange={(checked) => handleVerificationChange(group.daneCode, checked)} 
                                  disabled={group.isFullyVerified} 
                                />
                                <Label 
                                  htmlFor={`verif-${group.daneCode}`} 
                                  className="text-sm font-medium leading-none cursor-pointer whitespace-nowrap"
                                >
                                  Reporte Verificado
                                </Label>
                              </div>

                              <Button type="button" variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); setRejectionTarget({ daneCode: group.daneCode, institutionName: group.institutionName }); }} disabled={isRejectionLoading === group.daneCode}>
                                <FileWarning className="h-4 w-4 mr-2"/>Rechazar
                              </Button>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Cédula</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Cargo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Verificado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.reports.map((r, ridx) => (
                                <TableRow key={ridx}>
                                  <TableCell>{r['Cédula']}</TableCell>
                                  <TableCell>{r['Nombre Completo']}</TableCell>
                                  <TableCell>{r['Cargo Actual']}</TableCell>
                                  <TableCell>{r['Estado del Reporte']}</TableCell>
                                  <TableCell>{r['Verificado'] || 'Pendiente'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : <p className="text-center text-muted-foreground mt-4">No hay reportes cargados.</p>}
              </CardContent>
            </Card>

            <div className="flex justify-end"><Button type="submit" size="lg" disabled={!canSubmit || form.formState.isSubmitting}>Enviar Verificación</Button></div>
        </form>
        </Form>
      </main>

      <AlertDialog open={!!rejectionTarget} onOpenChange={(open) => !open && setRejectionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar Reporte: {rejectionTarget?.institutionName}</AlertDialogTitle>
            <AlertDialogDescription>Ingrese el motivo del rechazo. El Rector recibirá esta observación para corregir el reporte.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="obs">Observación del Director (Obligatorio)</Label>
            <Textarea id="obs" value={rejectionObservation} onChange={(e) => setRejectionObservation(e.target.value)} placeholder="Ej: Falta reportar al docente Juan Pérez..." className="mt-2" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectionObservation('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={!rejectionObservation.trim()} className={buttonVariants({ variant: "destructive" })}>Confirmar Rechazo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bienvenido, Señor Director de núcleo.</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground/80">
              ¿Qué acción va a realizar en este momento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button className="py-6 justify-start h-auto whitespace-normal text-left" onClick={() => setShowWelcomeDialog(false)}>
              <ClipboardCheck className="mr-3 h-6 w-6 shrink-0" />
              <span>Verificar reportes enviados por las Instituciones Educativas</span>
            </Button>
            <Button variant="outline" className="py-6 justify-start h-auto whitespace-normal text-left border-primary text-primary" onClick={() => router.push('/verification/soportes')}>
              <ExternalLink className="mr-3 h-6 w-6 shrink-0" />
              <span>Realizar reporte de Ausentismo ante la SED-CAUCA</span>
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}