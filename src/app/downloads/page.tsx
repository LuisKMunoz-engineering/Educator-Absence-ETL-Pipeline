'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, Download, List, RefreshCw, Users, Shield, Trash2, Plus, Save, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { listReports } from "@/ai/flows/list-reports-flow";
import { downloadReport, DownloadReportInput } from "@/ai/flows/download-report-flow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUsers, saveUser, deleteUser, syncFromExcel, User } from "@/ai/flows/user-management-flow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DynamicLogo } from "@/components/dynamic-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DownloadsPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  // Reports State
  const [reports, setReports] = useState<string[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState<User | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);

  const fetchReports = async () => {
    setIsLoadingReports(true);
    try {
      const result = await listReports();
      if (result.success && result.reports) {
        setReports(result.reports);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al Cargar Reportes", description: error.message });
    } finally {
      setIsLoadingReports(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const result = await getUsers();
      setUsers(result);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al Cargar Usuarios", description: error.message });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSyncUsers = async () => {
    setIsSyncing(true);
    try {
      const result = await syncFromExcel();
      if (result.success) {
        toast({ title: "Sincronización Exitosa", description: `Se encontraron ${result.count} usuarios.` });
        fetchUsers();
      } else {
        throw new Error(result.error || "Ocurrió un error al sincronizar.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Sincronización", description: error.message });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchReports();
    fetchUsers();
  }, []);

  const handleDownload = async (fileName: string) => {
    setDownloadingFile(fileName);
    try {
      const input: DownloadReportInput = { fileName };
      const result = await downloadReport(input);

      if (result.success && result.fileContent && result.fileName) {
        const link = document.createElement('a');
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.fileContent}`;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Descarga Exitosa", description: `El archivo ${result.fileName} ha comenzado a descargarse.` });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Descarga", description: error.message });
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const role = formData.get('role') as 'rector' | 'director';
    
    const newUser: User = {
        email: (formData.get('email') as string).trim().toLowerCase(),
        password: (formData.get('password') as string).trim(),
        role: role,
        name: formData.get('name') as string,
        municipality: formData.get('municipality') as string || undefined,
        dane: formData.get('dane') as string || undefined,
        institution: formData.get('institution') as string || undefined,
        cedula: formData.get('cedula') as string || undefined,
        daneCodes: (formData.get('daneCodes') as string || '').split(',').map(c => c.trim()).filter(c => !!c),
    };

    try {
        await saveUser(newUser);
        toast({ title: isEditingUser ? "Usuario Actualizado" : "Usuario Creado" });
        setIsUserDialogOpen(false);
        setIsEditingUser(null);
        fetchUsers();
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (!confirm("¿Está seguro de eliminar este usuario?")) return;
    try {
        await deleteUser(email);
        toast({ title: "Usuario Eliminado" });
        fetchUsers();
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const getFormattedMonth = (fileName: string) => {
    const match = fileName.match(/_(\d{4})-(\d{2})\.xlsx$/);
    if (!match) return fileName;
    const [, year, month] = match;
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="p-4 flex justify-between items-center bg-card border-b sticky top-0 z-10 h-24">
        <div className="flex items-center">
          <DynamicLogo width={80} height={80} />
          <h2 className="ml-4 text-xl font-bold text-primary hidden md:block uppercase">Panel de Administración</h2>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl mx-auto">
        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 h-12">
            <TabsTrigger value="reports" className="flex items-center gap-2 text-base">
              <Download className="h-5 w-5" /> Reportes Consolidados
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" /> Gestión de Usuarios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl font-bold text-primary font-headline">Descarga de Reportes</CardTitle>
                    <CardDescription>Visualice y descargue los archivos consolidados de ausentismo del mes.</CardDescription>
                  </div>
                  <Button variant="outline" size="icon" onClick={fetchReports} disabled={isLoadingReports}>
                    <RefreshCw className={`h-4 w-4 ${isLoadingReports ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingReports ? (
                  <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                ) : reports.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mes del Reporte</TableHead>
                        <TableHead>Nombre del Archivo</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((name) => (
                        <TableRow key={name}>
                          <TableCell className="font-semibold capitalize text-base">{getFormattedMonth(name)}</TableCell>
                          <TableCell className="text-muted-foreground">{name}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => handleDownload(name)} disabled={downloadingFile === name}>
                              {downloadingFile === name ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                              Descargar .xlsx
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-20 border border-dashed rounded-lg bg-muted/20">
                    <List className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                    <p className="mt-4 text-muted-foreground font-medium">No se encontraron archivos de reporte en el servidor.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle className="text-2xl font-bold text-primary font-headline">Gestión de Usuarios</CardTitle>
                    <CardDescription>Administre las cuentas de Rectores y Directores de Núcleo que acceden al sistema.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleSyncUsers} disabled={isSyncing} className="gap-2">
                      <FileSpreadsheet className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      Sincronizar desde Excel
                    </Button>
                    <Button variant="outline" size="icon" onClick={fetchUsers} disabled={isLoadingUsers}>
                      <RefreshCw className={`h-4 w-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                    </Button>
                    
                    <Dialog open={isUserDialogOpen} onOpenChange={(open) => { setIsUserDialogOpen(open); if(!open) setIsEditingUser(null); }}>
                      <DialogTrigger asChild>
                        <Button className="gap-2"><Plus className="h-4 w-4" /> Nuevo Usuario</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <form onSubmit={handleSaveUser}>
                        <DialogHeader>
                          <DialogTitle className="text-xl font-bold text-primary">{isEditingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
                          <DialogDescription>Ingrese los datos para la cuenta de acceso.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6">
                          <div className="space-y-2">
                            <Label>Rol del Usuario</Label>
                            <Select name="role" defaultValue={isEditingUser?.role || 'rector'} onValueChange={(v) => setIsEditingUser(prev => prev ? {...prev, role: v as any} : {role: v as any} as any)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="rector">Rector / Director Rural</SelectItem>
                                <SelectItem value="director">Director de Núcleo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Nombre Completo</Label>
                            <Input name="name" defaultValue={isEditingUser?.name} required placeholder="Nombre y Apellidos" />
                          </div>
                          <div className="space-y-2">
                            <Label>Correo Electrónico (Usuario)</Label>
                            <Input name="email" type="email" defaultValue={isEditingUser?.email} required placeholder="ejemplo@correo.com" />
                          </div>
                          <div className="space-y-2">
                            <Label>Contraseña</Label>
                            <Input name="password" type="text" defaultValue={isEditingUser?.password} required placeholder="Clave de acceso" />
                          </div>
                          
                          {(isEditingUser?.role === 'rector' || !isEditingUser?.role) && (
                            <>
                              <div className="space-y-2">
                                <Label>Código DANE</Label>
                                <Input name="dane" defaultValue={isEditingUser?.dane} placeholder="1234567890" />
                              </div>
                              <div className="space-y-2">
                                <Label>Establecimiento Educativo</Label>
                                <Input name="institution" defaultValue={isEditingUser?.institution} placeholder="Nombre de la Institución" />
                              </div>
                              <div className="space-y-2 col-span-full">
                                <Label>Municipio</Label>
                                <Input name="municipality" defaultValue={isEditingUser?.municipality} placeholder="Nombre del Municipio" />
                              </div>
                            </>
                          )}
                          
                          {isEditingUser?.role === 'director' && (
                            <>
                              <div className="space-y-2">
                                <Label>Cédula de Ciudadanía</Label>
                                <Input name="cedula" defaultValue={isEditingUser?.cedula} placeholder="Número de identificación" />
                              </div>
                              <div className="space-y-2 col-span-full">
                                <Label>Códigos DANE Autorizados (Separados por coma)</Label>
                                <Input name="daneCodes" defaultValue={isEditingUser?.daneCodes?.join(', ')} placeholder="123, 456, 789" />
                              </div>
                            </>
                          )}
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="ghost" onClick={() => setIsUserDialogOpen(false)}>Cancelar</Button>
                          <Button type="submit" className="gap-2"><Save className="h-4 w-4" /> Guardar Usuario</Button>
                        </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                ) : users.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email / Usuario</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Información Asociada</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.email}>
                          <TableCell className="font-semibold text-base">{user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                             <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${user.role === 'rector' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                {user.role === 'rector' ? 'Rector' : 'Director'}
                             </span>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">
                            {user.role === 'rector' 
                              ? `${user.institution || 'N/A'} (DANE: ${user.dane || 'N/A'})` 
                              : `${user.daneCodes?.length || 0} Sedes asignadas`}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" title="Editar Usuario" onClick={() => { setIsEditingUser(user); setIsUserDialogOpen(true); }}>
                                <Shield className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button size="icon" variant="ghost" title="Eliminar Usuario" onClick={() => handleDeleteUser(user.email)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-20 border border-dashed rounded-lg bg-muted/20">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                    <p className="mt-4 text-muted-foreground font-medium">No hay usuarios registrados. Utilice el botón de Sincronización.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}