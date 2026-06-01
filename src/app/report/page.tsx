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
import { PlusCircle, Send, LogOut, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useEffect } from "react";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { startOfMonth, endOfMonth, addMonths, format, isValid } from 'date-fns';

const reportItemSchema = z.object({
  cedula: z.string().min(1, "Requerido"),
  nombreCompleto: z.string().min(1, "Requerido"),
  cargoActual: z.string().optional(),
  fechaInicio: z.string().optional(),
  fechaFinal: z.string().optional(),
  fechaAusenciaUnDia: z.string().optional(),
  horaInicio: z.string().optional(),
  horaFinal: z.string().optional(),
  fechaSolicitudPermiso: z.string().optional(),
  fechaAutorizacionPermiso: z.string().optional(),
  motivoPermiso: z.string().optional(),
  observaciones: z.string().optional(),
  isManual: z.boolean().optional(),
});

const formSchema = z.object({
  reporterName: z.string().min(1, "El nombre es requerido."),
  reporterPosition: z.string().min(1, "El cargo es requerido."),
  municipality: z.string().min(1, "El municipio es requerido."),
  month: z.string().min(1, "El mes es requerido."),
  daneNumber: z.string().min(1, "El número DANE es requerido."),
  absenteeismChoice: z.enum(['yes', 'no'], {
    required_error: "Debe seleccionar si hubo ausentismo.",
  }),
  reports: z.array(reportItemSchema),
});

type FormValues = z.infer<typeof formSchema>;

const municipalities = ["ALMAGUER", "ARGELIA", "BALBOA", "BOLIVAR", "BUENOS AIRES", "CAJIBIO", "CALDONO", "CALOTO", "CORINTO", "EL TAMBO", "FLORENCIA", "GUACHENE", "GUAPI", "INZA", "JAMBALO", "LA SIERRA", "LA VEGA", "LOPEZ DE MICAY", "MERCADERES", "MIRANDA", "MORALES", "PADILLA", "PAEZ", "PATIA Y AFRO SUR", "PIAMONTE", "PIENDAMO", "PUERTO TEJADA", "PURACE", "ROSAS", "SAN SEBASTIAN", "SANTANDER DE QUILICHAO", "SANTA ROSA", "SANTA ROSA MBC", "SILVIA", "SOTARA", "SUAREZ", "SUCRE", "TIMBIO", "TIMBIQUI", "TORIBIO", "TOTORO", "VILLARICA"];
const motivosDePermiso = ["Adopción", "Calamidad Doméstica", "Capacitación", "Cita Médica", "Cita Médica Familiar", "Comisión de Estudios", "Comisión de Servicios", "Diligencias Administrativas", "Enfermedad Hijos o Familiar", "Evento Deportivo", "Matrimonio", "Huelga Autorizada", "Huelga No Autorizada", "Permisos Sindicales", "Tratamiento Médico", "Amenaza y Desplazamiento", "Arresto Correccional", "Desaparición", "Hospitalización", "Incapacidad", "Lactancia", "Licencia No Remunerada", "No Justificada", "Retiro", "Sanción", "Secuestro", "Otros"];
const motivosDePermisoSinSolicitud = ["No Justificada"];

export default function ReportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isDaneLoading, setIsDaneLoading] = useState(false);
  const [institutionName, setInstitutionName] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reporterName: "",
      reporterPosition: "",
      municipality: "",
      month: "",
      daneNumber: "",
      absenteeismChoice: undefined,
      reports: [],
    },
    mode: 'onChange'
  });

  // Prefill data from localStorage
  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role === 'rector') {
      const name = localStorage.getItem('userName') || '';
      const municipality = localStorage.getItem('userMunicipality') || '';
      const dane = localStorage.getItem('userDaneNumber') || '';
      const instName = localStorage.getItem('userInstitutionName') || '';
      const position = localStorage.getItem('userPosition') || 'Rector / Director Rural';

      form.setValue('reporterName', name);
      form.setValue('reporterPosition', position);
      form.setValue('municipality', municipality);
      form.setValue('daneNumber', dane);
      setInstitutionName(instName);
    }
  }, [form]);

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "reports",
  });
  
  const isSubmitting = form.formState.isSubmitting;
  const canSubmit = form.formState.isValid;

  const absenteeismChoice = form.watch('absenteeismChoice');
  const monthValue = form.watch('month');

  const { dateRange, finalDateRange } = useMemo(() => {
    if (!monthValue) return { dateRange: undefined, finalDateRange: undefined };
    const baseDate = new Date(`${monthValue}-01T12:00:00`);
    if (!isValid(baseDate)) return { dateRange: undefined, finalDateRange: undefined };
    const startDateOfMonth = startOfMonth(baseDate);
    const generalMin = format(startDateOfMonth, 'yyyy-MM-dd');
    const generalMax = format(endOfMonth(startDateOfMonth), 'yyyy-MM-dd');
    const finalDateMaxDate = endOfMonth(addMonths(startDateOfMonth, 1));
    const finalMax = format(finalDateMaxDate, 'yyyy-MM-dd');
    return {
        dateRange: { min: generalMin, max: generalMax },
        finalDateRange: { min: generalMin, max: finalMax }
    };
  }, [monthValue]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  }

  const handleDaneLoad = async () => {
    const daneNumber = form.getValues("daneNumber");
    if (!daneNumber) {
      toast({ variant: "destructive", title: "Error", description: "Por favor ingrese el número DANE." });
      return;
    }
    setIsDaneLoading(true);
    setInstitutionName('');
    replace([]);

    try {
      const response = await fetch('/data/plantaActual.xlsx');
      if (!response.ok) throw new Error("No se pudo cargar el archivo de datos.");
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      const filteredData = jsonData.filter(row => String(row['CODIGO DANE']) === String(daneNumber));

      if (filteredData.length === 0) {
        toast({ variant: "destructive", title: "Sin resultados", description: "No se encontraron registros para el DANE proporcionado." });
        return;
      }
      
      const newReports = filteredData.map(row => ({
        cedula: String(row['CEDULA'] ?? ''),
        nombreCompleto: String(row['NOMBRE COMPLETO'] ?? ''),
        cargoActual: String(row['CARGO ACTUAL'] ?? ''),
        fechaInicio: '',
        fechaFinal: '',
        fechaAusenciaUnDia: '',
        horaInicio: '',
        horaFinal: '',
        fechaSolicitudPermiso: '',
        fechaAutorizacionPermiso: '',
        motivoPermiso: 'No Justificada',
        observaciones: '',
        isManual: false,
      }));

      replace(newReports);
      setInstitutionName(String(filteredData[0]['ESTABLECIMIENTO EDUCATIVO'] ?? ''));
      toast({ title: "Éxito", description: `Se cargaron ${newReports.length} registros.` });
    } catch (error) {
      console.error("Error al procesar el archivo:", error);
      toast({ variant: "destructive", title: "Error de carga", description: "No se pudo procesar el archivo Excel." });
      replace([]);
    } finally {
      setIsDaneLoading(false);
    }
  }

  const handleCedulaBlur = async (cedula: string, index: number) => {
    if (!cedula) return;
    try {
      const response = await fetch('/data/plantaActual.xlsx');
      if (!response.ok) throw new Error("No se pudo cargar el archivo de datos.");
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
      const foundRow = jsonData.find(row => String(row['CEDULA']) === cedula);
      if (foundRow) {
        form.setValue(`reports.${index}.nombreCompleto`, String(foundRow['NOMBRE COMPLETO'] ?? ''));
        form.setValue(`reports.${index}.cargoActual`, String(foundRow['CARGO ACTUAL'] ?? ''));
        form.trigger(`reports.${index}.nombreCompleto`);
      } else {
        form.setValue(`reports.${index}.nombreCompleto`, '');
        form.setValue(`reports.${index}.cargoActual`, '');
        toast({ variant: "destructive", title: "Cédula no encontrada", description: "No se encontró el registro." });
      }
    } catch (error) {
        console.error("Error al buscar la cédula:", error);
    }
  }

  function onSubmit(data: FormValues) {
    let reportsToSend: z.infer<typeof reportItemSchema>[] = [];
    if (data.absenteeismChoice === 'yes') {
        const hasAnyValue = (report: z.infer<typeof reportItemSchema>) => 
            report.fechaInicio || report.fechaFinal || report.fechaAusenciaUnDia ||
            report.horaInicio || report.horaFinal || report.fechaSolicitudPermiso ||
            report.fechaAutorizacionPermiso || (report.motivoPermiso && report.motivoPermiso !== 'No Justificada') || report.observaciones;
        
        const reportsWithData = data.reports.filter(hasAnyValue);
        if (reportsWithData.length === 0) {
          toast({ variant: "destructive", title: "Sin Datos", description: "Debe diligenciar al menos una novedad." });
          return;
        }
        reportsToSend = reportsWithData;
    } else {
        reportsToSend = [{
            cedula: 'N/A',
            nombreCompleto: 'N/A',
            cargoActual: 'N/A',
            observaciones: 'Sin ausentismo reportado para este mes.',
            isManual: true,
            fechaInicio: '',
            fechaFinal: '',
            fechaAusenciaUnDia: '',
            horaInicio: '',
            horaFinal: '',
            fechaSolicitudPermiso: '',
            fechaAutorizacionPermiso: '',
            motivoPermiso: '',
        }];
    }
    const dataToSend = { ...data, reports: reportsToSend, institutionName };
    const query = encodeURIComponent(JSON.stringify(dataToSend));
    router.push(`/summary?data=${query}`);
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
              <h1 className="text-3xl font-bold text-primary font-headline mt-2">Reporte de Ausentismo Laboral</h1>
            </div>
            
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                <CardHeader>
                    <CardTitle>Información del Reportante</CardTitle>
                    <CardDescription>Datos identificados automáticamente para el reporte.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="reporterName" render={({ field }) => (
                        <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input readOnly className="bg-muted/20" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="reporterPosition" render={({ field }) => (
                        <FormItem><FormLabel>Cargo</FormLabel><FormControl><Input readOnly className="bg-muted/20" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="municipality" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Municipio</FormLabel>
                        <FormControl><Input readOnly className="bg-muted/20" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="month" render={({ field }) => (
                        <FormItem><FormLabel>Mes del Reporte</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Información Establecimiento Educativo</CardTitle>
                        <CardDescription>Datos de la institución.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-end gap-4">
                          <FormField control={form.control} name="daneNumber" render={({ field }) => (
                              <FormItem className="flex-grow">
                                  <FormLabel>Número DANE</FormLabel>
                                  <FormControl><Input readOnly className="bg-muted/20" {...field} /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )} />
                          <Button type="button" onClick={handleDaneLoad} disabled={isDaneLoading || absenteeismChoice !== 'yes'}>
                            {isDaneLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                            {isDaneLoading ? 'Cargando...' : 'Cargar Planta'}
                          </Button>
                        </div>
                        {institutionName && (
                          <FormItem>
                            <FormLabel>Nombre de la Institución Educativa</FormLabel>
                            <FormControl><Input readOnly value={institutionName} className="bg-muted/20" /></FormControl>
                          </FormItem>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Confirmación de Novedades</CardTitle>
                        <CardDescription>¿Se presentaron ausencias en el mes reportado?</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FormField
                            control={form.control}
                            name="absenteeismChoice"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={(value: 'yes' | 'no') => {
                                                field.onChange(value);
                                                if (value === 'no') replace([]);
                                            }}
                                            value={field.value}
                                            className="flex items-center space-x-4"
                                        >
                                            <FormItem className="flex items-center space-x-2">
                                                <RadioGroupItem value="yes" id="choice-yes" />
                                                <Label htmlFor="choice-yes" className="font-normal cursor-pointer">Sí</Label>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2">
                                                <RadioGroupItem value="no" id="choice-no" />
                                                <Label htmlFor="choice-no" className="font-normal cursor-pointer">No</Label>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>
                
                <fieldset disabled={absenteeismChoice !== 'yes'} className="space-y-6">
                <Card className="bg-blue-50/10 dark:bg-blue-900/10 disabled:opacity-50">
                    <CardHeader><CardTitle>Items del Reporte</CardTitle></CardHeader>
                    <CardContent>
                      <div className="w-full overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[140px]">Cédula</TableHead>
                              <TableHead className="w-auto whitespace-nowrap">Nombre Completo</TableHead>
                              <TableHead className="w-auto whitespace-nowrap">Cargo Actual</TableHead>
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
                            {fields.map((field, index) => {
                              const fechaInicioV = form.watch(`reports.${index}.fechaInicio`);
                              const fechaFinalV = form.watch(`reports.${index}.fechaFinal`);
                              const fechaAusenciaV = form.watch(`reports.${index}.fechaAusenciaUnDia`);
                              const horaInicioV = form.watch(`reports.${index}.horaInicio`);
                              const horaFinalV = form.watch(`reports.${index}.horaFinal`);
                              const disableMulti = !!(fechaAusenciaV || horaInicioV || horaFinalV);
                              const disableSingle = !!(fechaInicioV || fechaFinalV);
                              const fechaSolV = form.watch(`reports.${index}.fechaSolicitudPermiso`);
                              const motivosPermitidos = fechaSolV ? motivosDePermiso : motivosDePermisoSinSolicitud;

                              return (
                                <TableRow key={field.id}>
                                  <TableCell className="font-medium">
                                    {field.isManual ? (
                                      <FormField control={form.control} name={`reports.${index}.cedula`} render={({ field }) => (
                                          <Input {...field} className="w-32" onBlur={(e) => { field.onBlur(); handleCedulaBlur(e.target.value, index); }} />
                                      )} />
                                    ) : ( <div className="w-32 whitespace-nowrap">{field.cedula}</div> )}
                                  </TableCell>
                                  <TableCell>
                                      <div className="w-64 whitespace-nowrap">
                                          {field.isManual ? (
                                              <FormField control={form.control} name={`reports.${index}.nombreCompleto`} render={({ field }) => (
                                                  <Input {...field} readOnly className="bg-muted/20" />
                                              )} />
                                          ) : ( field.nombreCompleto )}
                                      </div>
                                  </TableCell>
                                  <TableCell>
                                      <div className="w-64 whitespace-nowrap">
                                          {field.isManual ? (
                                              <FormField control={form.control} name={`reports.${index}.cargoActual`} render={({ field }) => (
                                                  <Input {...field} readOnly className="bg-muted/20" />
                                              )} />
                                          ) : ( field.cargoActual )}
                                      </div>
                                  </TableCell>
                                  <TableCell><FormField control={form.control} name={`reports.${index}.fechaInicio`} render={({ field }) => (<Input type="date" {...field} min={dateRange?.min} max={dateRange?.max} disabled={!monthValue || disableMulti} />)}/></TableCell>
                                  <TableCell><FormField control={form.control} name={`reports.${index}.fechaFinal`} render={({ field }) => (<Input type="date" {...field} min={finalDateRange?.min} max={finalDateRange?.max} disabled={!monthValue || disableMulti} />)}/></TableCell>
                                  <TableCell><FormField control={form.control} name={`reports.${index}.fechaAusenciaUnDia`} render={({ field }) => (<Input type="date" {...field} min={dateRange?.min} max={dateRange?.max} disabled={!monthValue || disableSingle} />)}/></TableCell>
                                  <TableCell><FormField control={form.control} name={`reports.${index}.horaInicio`} render={({ field }) => (<Input type="time" {...field} disabled={disableSingle} />)}/></TableCell>
                                  <TableCell><FormField control={form.control} name={`reports.${index}.horaFinal`} render={({ field }) => (<Input type="time" {...field} disabled={disableSingle} />)}/></TableCell>
                                  <TableCell>
                                    <FormField control={form.control} name={`reports.${index}.fechaSolicitudPermiso`} render={({ field }) => (
                                      <Input type="date" {...field} min={dateRange?.min} max={dateRange?.max} disabled={!monthValue} onChange={(e) => {
                                          field.onChange(e);
                                          if (!e.target.value) {
                                              form.setValue(`reports.${index}.motivoPermiso`, 'No Justificada');
                                              form.setValue(`reports.${index}.fechaAutorizacionPermiso`, '');
                                          } else if (form.getValues(`reports.${index}.motivoPermiso`) === 'No Justificada') {
                                              form.setValue(`reports.${index}.motivoPermiso`, ''); 
                                          }
                                      }}/>
                                    )}/>
                                  </TableCell>
                                  <TableCell><FormField control={form.control} name={`reports.${index}.fechaAutorizacionPermiso`} render={({ field }) => (<Input type="date" {...field} min={dateRange?.min} max={dateRange?.max} disabled={!monthValue || !fechaSolV} />)}/></TableCell>
                                  <TableCell>
                                    <FormField control={form.control} name={`reports.${index}.motivoPermiso`} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value || ''}>
                                          <FormControl><SelectTrigger disabled={!fechaSolV}><SelectValue placeholder="Motivo" /></SelectTrigger></FormControl>
                                          <SelectContent>{motivosPermitidos.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}</SelectContent>
                                        </Select>
                                      )} />
                                  </TableCell>
                                  <TableCell><FormField control={form.control} name={`reports.${index}.observaciones`} render={({ field }) => (<Textarea {...field} />)}/></TableCell>
                                  <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <Button type="button" variant="outline" className="mt-6 border-dashed" onClick={() => append({ cedula: '', nombreCompleto: '', cargoActual: '', fechaInicio: '', fechaFinal: '', fechaAusenciaUnDia: '', horaInicio: '', horaFinal: '', fechaSolicitudPermiso: '', fechaAutorizacionPermiso: '', motivoPermiso: 'No Justificada', observaciones: '', isManual: true })}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Agregar Fila Manuelmente
                      </Button>
                      {form.formState.errors.reports?.root && ( <p className="text-sm font-medium text-destructive mt-2">{form.formState.errors.reports.root.message}</p> )}
                    </CardContent>
                </Card>
                </fieldset>

                <Separator />
                <div className="flex justify-end items-center">
                    <Button type="submit" size="lg" disabled={!canSubmit || isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                        {isSubmitting ? 'Enviando...' : 'Enviar Reporte'}
                    </Button>
                </div>
            </form>
            </Form>
        </main>
    </div>
  );
}