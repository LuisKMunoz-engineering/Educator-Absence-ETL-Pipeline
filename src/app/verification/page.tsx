
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
import { Send, LogOut, Loader2, Upload, FileWarning, ClipboardCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getReportsForVerification } from "@/ai/flows/get-reports-for-verification-flow";
import { verifyReports } from "@/ai/flows/verify-reports-flow";
import { rejectReport } from "@/ai/flows/reject-report-flow";
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

  const canSubmit = form.formState.isValid && allReports.length > 0 && (newlyVerifiedCount > 0 || groupedReports.some(g => g.isFullyVerified));

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
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
        const input = {
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
      
      const summaryData = { 
        directorName: data.reporterName, 
        month: data.month, 
        verifiedInstitutions: verifiedInsts 
      };

      // Usamos sessionStorage para evitar el error 414
      sessionStorage.setItem('verificationSummaryData', JSON.stringify(summaryData));
      router.push('/verification-summary');

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
                  <Accordion type="multiple" className="w-full space-y-4">
                    {groupedReports.map((group, idx) => (
                      <AccordionItem value={`item-${idx}`} key={group.daneCode} className="border rounded-lg overflow-hidden shadow-sm bg-card">
                        <div className="flex items-center justify-between border-b bg-muted/20">
                          <AccordionTrigger className="flex-1 px-4 py-4 hover:no-underline text-left">
                            <div className="flex flex-col">
                              <span className="font-semibold text-primary">{group.institutionName}</span>
                              <span className="text-xs text-muted-foreground uppercase tracking-wider">DANE: {group.daneCode}</span>
                            </div>
                          </AccordionTrigger>
                          
                          <div className="flex items-center gap-3 px-4 py-2 shrink-0">
                            <Badge variant={group.status === 'Rechazado para corrección' ? 'destructive' : group.status === 'Verificado' ? 'default' : 'secondary'}>
                              {group.status}
                            </Badge>
                            
                            <div className="flex items-center space-x-2 bg-background border px-3 py-1.5 rounded-md shadow-sm">
                              <Checkbox 
                                id={`verif-${group.daneCode}`}
                                checked={verifiedStatus[group.daneCode] || group.isFullyVerified || false} 
                                onCheckedChange={(checked) => handleVerificationChange(group.daneCode, checked)} 
                                disabled={group.isFullyVerified} 
                              />
                              <Label 
                                htmlFor={`verif-${group.daneCode}`} 
                                className="text-xs font-bold leading-none cursor-pointer whitespace-nowrap"
                              >
                                Verificado
                              </Label>
                            </div>

                            <Button 
                              type="button" 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => setRejectionTarget({ daneCode: group.daneCode, institutionName: group.institutionName })} 
                              disabled={isRejectionLoading === group.daneCode || group.isFullyVerified}
                              className="h-9 shadow-sm"
                            >
                              <FileWarning className="h-4 w-4 mr-2"/>Rechazar
                            </Button>
                          </div>
                        </div>

                        <AccordionContent className="bg-background">
                          <div className="w-full overflow-x-auto p-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="whitespace-nowrap">Cédula</TableHead>
                                  <TableHead className="whitespace-nowrap">Nombre Completo</TableHead>
                                  <TableHead className="whitespace-nowrap">Cargo Actual</TableHead>
                                  <TableHead className="whitespace-nowrap">Fecha Inicio</TableHead>
                                  <TableHead className="whitespace-nowrap">Fecha Final</TableHead>
                                  <TableHead className="whitespace-nowrap">Ausencia &lt; 1 día</TableHead>
                                  <TableHead className="whitespace-nowrap">H. Inicio</TableHead>
                                  <TableHead className="whitespace-nowrap">H. Final</TableHead>
                                  <TableHead className="whitespace-nowrap">F. Solicitud</TableHead>
                                  <TableHead className="whitespace-nowrap">F. Autorización</TableHead>
                                  <TableHead className="whitespace-nowrap">Motivo</TableHead>
                                  <TableHead className="whitespace-nowrap">Observaciones</TableHead>
                                  <TableHead className="whitespace-nowrap">Verificado</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.reports.map((r, ridx) => (
                                  <TableRow key={ridx} className="hover:bg-muted/30">
                                    <TableCell className="font-medium">{r['Cédula']}</TableCell>
                                    <TableCell className="whitespace-nowrap font-medium">{r['Nombre Completo']}</TableCell>
                                    <TableCell className="whitespace-nowrap">{r['Cargo Actual']}</TableCell>
                                    <TableCell className="whitespace-nowrap">{r['Fecha Inicio']}</TableCell>
                                    <TableCell className="whitespace-nowrap">{r['Fecha Final']}</TableCell>
                                    <TableCell className="whitespace-nowrap">{r['Fecha Ausencia menos de un día']}</TableCell>
                                    <TableCell>{r['Hora Inicio']}</TableCell>
                                    <TableCell>{r['Hora Final']}</TableCell>
                                    <TableCell className="whitespace-nowrap">{r['Fecha Solicitud Permiso']}</TableCell>
                                    <TableCell className="whitespace-nowrap">{r['Fecha Autorización Permiso']}</TableCell>
                                    <TableCell className="whitespace-nowrap">{r['Motivo de Permiso']}</TableCell>
                                    <TableCell className="max-w-xs truncate italic text-muted-foreground" title={r['Observaciones']}>{r['Observaciones']}</TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      {r['Verificado'] ? (
                                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">
                                          {r['Verificado']}
                                        </Badge>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">Pendiente</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : <p className="text-center text-muted-foreground mt-4 py-8 border border-dashed rounded-lg">No hay reportes cargados para el mes seleccionado.</p>}
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
              <Button type="submit" size="lg" disabled={!canSubmit || form.formState.isSubmitting} className="h-12 px-8 font-bold shadow-md">
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                Enviar Verificación de Reportes
              </Button>
            </div>
        </form>
        </Form>
      </main>

      <AlertDialog open={!!rejectionTarget} onOpenChange={(open) => !open && setRejectionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <FileWarning className="h-6 w-6" />
              Rechazar Reporte Institucional
            </AlertDialogTitle>
            <AlertDialogDescription className="font-semibold text-foreground">
              Establecimiento: {rejectionTarget?.institutionName}
            </AlertDialogDescription>
            <div className="mt-4 space-y-2">
              <Label htmlFor="obs" className="text-primary font-bold">Observación del Director (Obligatorio)</Label>
              <Textarea 
                id="obs" 
                value={rejectionObservation} 
                onChange={(e) => setRejectionObservation(e.target.value)} 
                placeholder="Indique detalladamente qué novedades deben ser corregidas o agregadas por el rector..." 
                className="mt-2 min-h-[120px]" 
              />
              <p className="text-[10px] text-muted-foreground italic">Esta observación será visible para el Rector al momento de intentar reportar de nuevo.</p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel onClick={() => setRejectionObservation('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReject} 
              disabled={!rejectionObservation.trim()} 
              className={buttonVariants({ variant: "destructive" })}
            >
              Confirmar y Enviar Rechazo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-primary">Bienvenido, Señor Director de Núcleo</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground/80 py-4">
              ¿Qué acción desea realizar en este momento para la gestión de ausentismo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button className="py-8 justify-start h-auto whitespace-normal text-left shadow-md transition-all hover:scale-[1.02]" onClick={() => setShowWelcomeDialog(false)}>
              <ClipboardCheck className="mr-4 h-8 w-8 shrink-0 text-white" />
              <div>
                <p className="font-bold text-lg">Verificar reportes</p>
                <p className="text-sm opacity-90">Revisar y validar los reportes de los establecimientos educativos.</p>
              </div>
            </Button>
            <Button variant="outline" className="py-8 justify-start h-auto whitespace-normal text-left border-primary text-primary shadow-sm transition-all hover:scale-[1.02] hover:bg-primary/5" onClick={() => router.push('/verification/soportes')}>
              <ExternalLink className="mr-4 h-8 w-8 shrink-0" />
              <div>
                <p className="font-bold text-lg">Reportar Ausentismo ante la SED</p>
                <p className="text-sm">Cargar evidencias y soportes finales en el formulario oficial de la Secretaría de Educación Departamental.</p>
              </div>
            </Button>
          </div>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setShowWelcomeDialog(false)} className="text-xs text-muted-foreground">Omitir por ahora</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
