'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Send, LogOut, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getReportsForVerification, GetReportsForVerificationInput } from "@/ai/flows/get-reports-for-verification-flow";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";

const reportItemSchema = z.object({
  'DANE ESTABLECIMIENTO EDUCATIVO': z.string(),
  'ESTABLECIMIENTO EDUCATIVO': z.string(),
  'Cédula': z.string(),
  'Nombre Completo': z.string(),
  'Fecha Inicio': z.string().optional(),
  'Fecha Final': z.string().optional(),
  'Fecha Ausencia menos de un día': z.string().optional(),
  'Hora Inicio': z.string().optional(),
  'Hora Final': z.string().optional(),
  'Fecha Solicitud Permiso': z.string().optional(),
  'Fecha Autorización Permiso': z.string().optional(),
  'Motivo de Permiso': z.string().optional(),
  'Observaciones': z.string().optional(),
});

type ReportItem = z.infer<typeof reportItemSchema>;

const formSchema = z.object({
  reporterName: z.string(),
  reporterCedula: z.string(),
  reporterPosition: z.string(),
  month: z.string().min(1, "El mes es requerido."),
  reports: z.array(reportItemSchema),
});

type FormValues = z.infer<typeof formSchema>;

interface GroupedReport {
  institutionName: string;
  daneCode: string;
  reports: ReportItem[];
}

const motivosDePermiso = ["Adopción", "Calamidad Doméstica", "Capacitación", "Cita Médica", "Cita Médica Familiar", "Comisión de Servicios", "Diligencias Administrativas", "Enfermedad Hijos o Familiar", "Evento Deportivo", "Matrimonio", "No autorizada", "Permisos Sindicales", "Tratamiento Médico", "Amenaza y Desplazamiento", "Arresto Correccional", "Desaparición", "Hospitalización", "Incapacidad", "Lactancia", "Licencia No Remunerada", "No Justificada", "Retiro", "Sanción"];

export default function VerificationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [directorName, setDirectorName] = useState('');
  const [directorCedula, setDirectorCedula] = useState('');
  const [daneCodes, setDaneCodes] = useState<string[]>([]);
  const [groupedReports, setGroupedReports] = useState<GroupedReport[]>([]);
  const [verifiedStatus, setVerifiedStatus] = useState<Record<string, boolean>>({});

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
      reports: [],
    },
    mode: 'onChange'
  });

  useEffect(() => {
    form.setValue('reporterName', directorName);
    form.setValue('reporterCedula', directorCedula);
  }, [directorName, directorCedula, form]);

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "reports",
  });
  
  const isSubmitting = form.formState.isSubmitting;
  const canSubmit = form.formState.isValid && fields.length > 0;

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
    replace([]);
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
          return;
        }
        
        // Group reports by institution
        const groups: { [key: string]: GroupedReport } = {};
        result.reports.forEach(report => {
          const dane = report['DANE ESTABLECIMIENTO EDUCATIVO'].toString();
          if (!groups[dane]) {
            groups[dane] = {
              daneCode: dane,
              institutionName: report['ESTABLECIMIENTO EDUCATIVO'],
              reports: []
            };
          }
          groups[dane].reports.push(report);
        });

        setGroupedReports(Object.values(groups));
        replace(result.reports);

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

  function onSubmit(data: FormValues) {
    console.log("Datos a enviar para verificación final:", data);
    console.log("Estado de verificación:", verifiedStatus);
    // TODO: Implementar la lógica de envío final para el director
    toast({
        title: "Función en desarrollo",
        description: "La acción de enviar el reporte de verificación será implementada.",
    });
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
                                    <div className="flex items-center space-x-3 mr-4" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            id={`verif-${group.daneCode}`}
                                            checked={verifiedStatus[group.daneCode] || false}
                                            onCheckedChange={(checked) => handleVerificationChange(group.daneCode, checked)}
                                        />
                                        <label htmlFor={`verif-${group.daneCode}`} className="text-sm font-medium leading-none cursor-pointer">
                                            Reporte Verificado
                                        </label>
                                    </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="w-full overflow-x-auto">
                                    <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[140px]">Cédula</TableHead>
                                            <TableHead className="w-auto whitespace-nowrap">Nombre Completo</TableHead>
                                            <TableHead>Fecha Inicio</TableHead>
                                            <TableHead>Fecha Final</TableHead>
                                            <TableHead>Fecha Ausencia &lt; 1 día</TableHead>
                                            <TableHead>Hora Inicio</TableHead>
                                            <TableHead>Hora Final</TableHead>
                                            <TableHead>Fecha Solicitud</TableHead>
                                            <TableHead>Fecha Autorización</TableHead>
                                            <TableHead>Motivo</TableHead>
                                            <TableHead>Observaciones</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.filter(f => f['DANE ESTABLECIMIENTO EDUCATIVO'] === group.daneCode).map((field, localIndex) => {
                                            const globalIndex = fields.findIndex(f => f.id === field.id);
                                            return (
                                                <TableRow key={field.id}>
                                                    <TableCell className="font-medium">
                                                        <div className="w-32 whitespace-nowrap">{field['Cédula']}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="w-64 whitespace-nowrap">{field['Nombre Completo']}</div>
                                                    </TableCell>
                                                    <TableCell><FormField control={form.control} name={`reports.${globalIndex}.Fecha Inicio`} render={({ field }) => (<Input type="date" {...field} />)}/></TableCell>
                                                    <TableCell><FormField control={form.control} name={`reports.${globalIndex}.Fecha Final`} render={({ field }) => (<Input type="date" {...field} />)}/></TableCell>
                                                    <TableCell><FormField control={form.control} name={`reports.${globalIndex}.Fecha Ausencia menos de un día`} render={({ field }) => (<Input type="date" {...field} />)}/></TableCell>
                                                    <TableCell><FormField control={form.control} name={`reports.${globalIndex}.Hora Inicio`} render={({ field }) => (<Input type="time" {...field} />)}/></TableCell>
                                                    <TableCell><FormField control={form.control} name={`reports.${globalIndex}.Hora Final`} render={({ field }) => (<Input type="time" {...field} />)}/></TableCell>
                                                    <TableCell><FormField control={form.control} name={`reports.${globalIndex}.Fecha Solicitud Permiso`} render={({ field }) => (<Input type="date" {...field} />)}/></TableCell>
                                                    <TableCell><FormField control={form.control} name={`reports.${globalIndex}.Fecha Autorización Permiso`} render={({ field }) => (<Input type="date" {...field} />)}/></TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`reports.${globalIndex}.Motivo de Permiso`}
                                                            render={({ field }) => (
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Seleccione un motivo" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                {motivosDePermiso.map((motivo) => (
                                                                    <SelectItem key={motivo} value={motivo}>
                                                                    {motivo}
                                                                    </SelectItem>
                                                                ))}
                                                                </SelectContent>
                                                            </Select>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell><FormField control={form.control} name={`reports.${globalIndex}.Observaciones`} render={({ field }) => (<Textarea {...field} />)}/></TableCell>
                                                    <TableCell>
                                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(globalIndex)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
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
                      
                      {form.formState.errors.reports?.root && (
                          <p className="text-sm font-medium text-destructive mt-2">{form.formState.errors.reports.root.message}</p>
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
        </main>
    </div>
  );
}

    