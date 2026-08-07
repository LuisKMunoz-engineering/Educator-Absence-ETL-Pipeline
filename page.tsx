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
import { useState } from "react";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";

const reportItemSchema = z.object({
  cedula: z.string().min(1, "Requerido"),
  nombreCompleto: z.string().min(1, "Requerido"),
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
  reports: z.array(reportItemSchema).min(1, "Debe agregar al menos un reporte."),
});

type FormValues = z.infer<typeof formSchema>;

const municipalities = ["ALMAGUER", "ARGELIA", "BALBOA", "BOLIVAR", "BUENOS AIRES", "CAJIBIO", "CALDONO", "CALOTO", "CORINTO", "EL TAMBO", "FLORENCIA", "GUACHENE", "GUAPI", "INZA", "JAMBALO", "LA SIERRA", "LA VEGA", "LOPEZ DE MICAY", "MERCADERES", "MIRANDA", "MORALES", "PADILLA", "PAEZ", "PATIA Y AFRO SUR", "PIAMONTE", "PIENDAMO", "PUERTO TEJADA", "PURACE", "ROSAS", "SAN SEBASTIAN", "SANTANDER DE QUILICHAO", "SANTA ROSA", "SANTA ROSA MBC", "SILVIA", "SOTARA", "SUAREZ", "SUCRE", "TIMBIO", "TIMBIQUI", "TORIBIO", "TOTORO", "VILLARICA"];
const motivosDePermiso = ["Adopción", "Calamidad Doméstica", "Capacitación", "Cita Médica", "Cita Médica Familiar", "Comisión de Servicios", "Diligencias Administrativas", "Enfermedad Hijos o Familiar", "Evento Deportivo", "Matrimonio", "No autorizada", "Permisos Sindicales", "Tratamiento Médico", "Amenaza y Desplazamiento", "Arresto Correccional", "Desaparición", "Hospitalización", "Incapacidad", "Lactancia", "Licencia No Remunerada", "No Justificada", "Retiro", "Sanción", "Secuestro"];

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
      reports: [],
    },
    mode: 'onChange'
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "reports",
  });
  
  const isSubmitting = form.formState.isSubmitting;
  const canSubmit = form.formState.isValid;

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userRole');
    router.push('/login');
  }

  const handleDaneLoad = async () => {
    const daneNumber = form.getValues("daneNumber");
    if (!daneNumber) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor ingrese el número DANE.",
      });
      return;
    }
    setIsDaneLoading(true);
    setInstitutionName('');
    replace([]);

    try {
      const response = await fetch('/data/plantaActual.xlsx');
      if (!response.ok) {
        throw new Error("No se pudo cargar el archivo de datos.");
      }
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      const filteredData = jsonData.filter(row => String(row['CODIGO DANE']) === String(daneNumber));

      if (filteredData.length === 0) {
        toast({
          variant: "destructive",
          title: "Sin resultados",
          description: "No se encontraron registros para el DANE proporcionado.",
        });
        return;
      }
      
      const newReports = filteredData.map(row => ({
        cedula: String(row['CEDULA'] ?? ''),
        nombreCompleto: String(row['NOMBRE COMPLETO'] ?? ''),
        fechaInicio: '',
        fechaFinal: '',
        fechaAusenciaUnDia: '',
        horaInicio: '',
        horaFinal: '',
        fechaSolicitudPermiso: '',
        fechaAutorizacionPermiso: '',
        motivoPermiso: '',
        observaciones: '',
        isManual: false,
      }));

      replace(newReports);
      setInstitutionName(String(filteredData[0]['ESTABLECIMIENTO EDUCATIVO'] ?? ''));

      toast({
        title: "Éxito",
        description: `Se cargaron ${newReports.length} registros.`,
      });

    } catch (error) {
      console.error("Error al procesar el archivo:", error);
      toast({
        variant: "destructive",
        title: "Error de carga",
        description: "No se pudo procesar el archivo Excel. Asegúrese de que esté en public/data/plantaActual.xlsx",
      });
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
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      const foundRow = jsonData.find(row => String(row['CEDULA']) === cedula);
      
      if (foundRow) {
        form.setValue(`reports.${index}.nombreCompleto`, String(foundRow['NOMBRE COMPLETO'] ?? ''));
        form.trigger(`reports.${index}.nombreCompleto`);
      } else {
        form.setValue(`reports.${index}.nombreCompleto`, '');
         toast({
          variant: "destructive",
          title: "Cédula no encontrada",
          description: "No se encontró un registro con esa cédula en el archivo.",
        });
      }
    } catch (error) {
        console.error("Error al buscar la cédula:", error);
        toast({
            variant: "destructive",
            title: "Error de Búsqueda",
            description: "No se pudo buscar la cédula en el archivo Excel.",
        });
    }
  }

  function onSubmit(data: FormValues) {
    const dataToSend = { ...data, institutionName };
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
                    <CardDescription>Complete sus datos para el reporte.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="reporterName" render={({ field }) => (
                        <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input placeholder="Ej: Ramón Valdez" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="reporterPosition" render={({ field }) => (
                        <FormItem><FormLabel>Cargo</FormLabel><FormControl><Input placeholder="Ej: Director Rural" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="municipality" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Municipio</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione un municipio" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {municipalities.map((municipality) => (
                              <SelectItem key={municipality} value={municipality}>
                                {municipality}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <CardDescription>Complete los datos de la institución.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-end gap-4">
                          <FormField control={form.control} name="daneNumber" render={({ field }) => (
                              <FormItem className="flex-grow">
                                  <FormLabel>El número DANE de la Institución Educativa</FormLabel>
                                  <FormControl>
                                      <Input placeholder="Ej: 123456789012" {...field} />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )} />
                          <Button type="button" onClick={handleDaneLoad} disabled={isDaneLoading}>
                            {isDaneLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                            {isDaneLoading ? 'Cargando...' : 'Cargar'}
                          </Button>
                        </div>
                        {institutionName && (
                          <FormItem>
                            <FormLabel>Nombre de la Institución Educativa</FormLabel>
                            <FormControl>
                              <Input readOnly value={institutionName} className="bg-muted/20" />
                            </FormControl>
                          </FormItem>
                        )}
                    </CardContent>
                </Card>
                
                <Card className="bg-blue-50/10 dark:bg-blue-900/10">
                    <CardHeader>
                      <CardTitle>Items del Reporte</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="w-full overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[140px]">Cédula</TableHead>
                              <TableHead className="w-auto whitespace-nowrap">Nombre Completo</TableHead>
                              <TableHead>Fecha Inicio</TableHead>
                              <TableHead>Fecha Final</TableHead>
                              <TableHead>Fecha de Ausencia menos de un día</TableHead>
                              <TableHead>Hora Inicio</TableHead>
                              <TableHead>Hora Final</TableHead>
                              <TableHead>Fecha Solicitud Permiso</TableHead>
                              <TableHead>Fecha Autorización Permiso</TableHead>
                              <TableHead>Motivo de Permiso</TableHead>
                              <TableHead>Observaciones</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {fields.map((field, index) => (
                              <TableRow key={field.id}>
                                <TableCell className="font-medium">
                                  {field.isManual ? (
                                    <FormField
                                      control={form.control}
                                      name={`reports.${index}.cedula`}
                                      render={({ field }) => (
                                        <Input
                                          {...field}
                                          className="w-32"
                                          onBlur={(e) => {
                                            field.onBlur();
                                            handleCedulaBlur(e.target.value, index);
                                          }}
                                        />
                                      )}
                                    />
                                  ) : (
                                    <div className="w-32 whitespace-nowrap">{field.cedula}</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                    <div className="w-64 whitespace-nowrap">
                                        {field.isManual ? (
                                            <FormField
                                            control={form.control}
                                            name={`reports.${index}.nombreCompleto`}
                                            render={({ field }) => (
                                                <Input {...field} readOnly className="bg-muted/20" />
                                            )}
                                            />
                                        ) : (
                                            field.nombreCompleto
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell><FormField control={form.control} name={`reports.${index}.fechaInicio`} render={({ field }) => (<Input type="date" {...field} />)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`reports.${index}.fechaFinal`} render={({ field }) => (<Input type="date" {...field} />)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`reports.${index}.fechaAusenciaUnDia`} render={({ field }) => (<Input type="date" {...field} />)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`reports.${index}.horaInicio`} render={({ field }) => (<Input type="time" {...field} />)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`reports.${index}.horaFinal`} render={({ field }) => (<Input type="time" {...field} />)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`reports.${index}.fechaSolicitudPermiso`} render={({ field }) => (<Input type="date" {...field} />)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`reports.${index}.fechaAutorizacionPermiso`} render={({ field }) => (<Input type="date" {...field} />)}/></TableCell>
                                <TableCell>
                                  <FormField
                                    control={form.control}
                                    name={`reports.${index}.motivoPermiso`}
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
                                <TableCell><FormField control={form.control} name={`reports.${index}.observaciones`} render={({ field }) => (<Textarea {...field} />)}/></TableCell>
                                <TableCell>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <Button
                          type="button"
                          variant="outline"
                          className="mt-6 border-dashed"
                          onClick={() => append({ cedula: '', nombreCompleto: '', fechaInicio: '', fechaFinal: '', fechaAusenciaUnDia: '', horaInicio: '', horaFinal: '', fechaSolicitudPermiso: '', fechaAutorizacionPermiso: '', motivoPermiso: '', observaciones: '', isManual: true })}>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Agregar Fila Manualmente
                      </Button>
                      {form.formState.errors.reports?.root && (
                          <p className="text-sm font-medium text-destructive mt-2">{form.formState.errors.reports.root.message}</p>
                      )}
                      {fields.length === 0 && (
                          <p className="text-sm text-muted-foreground mt-4 text-center">
                              Ingrese un número DANE y haga clic en 'Cargar' para llenar la tabla automáticamente, o agregue filas manualmente.
                          </p>
                      )}
                    </CardContent>
                </Card>

                <Separator />

                <div className="flex justify-end items-center">
                    <Button type="submit" size="lg" disabled={!canSubmit || isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                        {isSubmitting ? 'Enviando...' : 'Enviar Reportes'}
                    </Button>
                </div>
            </form>
            </Form>
        </main>
    </div>
  );
}
