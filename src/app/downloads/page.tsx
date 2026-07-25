'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, Download, List, RefreshCw, Users, Shield, Trash2, Plus, Save, FileSpreadsheet, CalendarClock, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { listReports } from "@/ai/flows/list-reports-flow";
import { downloadReport, DownloadReportInput } from "@/ai/flows/download-report-flow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUsers, saveUser, deleteUser, syncFromExcel, User } from "@/ai/flows/user-management-flow";
import { getAppSettings, updateAppSettings, AppSettings } from "@/ai/flows/settings-flow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DynamicLogo } from "@/components/dynamic-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";

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

  // Settings State
  const [settings, setSettings] = useState<AppSettings>({ rectorEnabled: true, directorEnabled: true });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

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

  const fetchSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const result = await getAppSettings();
      setSettings(result);
    } catch (error: any) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoadingSettings(false);
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
    fetchSettings();
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

  const handleToggleSettings = async (key: keyof AppSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setIsUpdatingSettings(true);
    try {
        await updateAppSettings(newSettings);
        toast({ 
            title: "Configuración Actualizada", 
            description: `Acceso para ${key === 'rectorEnabled' ? 'Rectores' : 'Directores'} ${value ? 'Habilitado' : 'Deshabilitado'}` 
        });
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la configuración." });
        setSettings(settings); // Rollback UI
    } finally {
        setIsUpdatingSettings(false);
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card className="lg:col-span-1 border-primary/20 shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <CalendarClock className="h-5 w-5 text-primary" />
                        Control de Cronograma
                    </CardTitle>
                    <CardDescription>Active o desactive el acceso para reportes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="space-y-0.5">
                            <Label className="text-base font-semibold">Acceso Rectores</Label>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {settings.rectorEnabled ? <Unlock className="h-3 w-3 text-green-500" /> : <Lock className="h-3 w-3 text-red-500" />}
                                {settings.rectorEnabled ? 'Habilitado' : 'Bloqueado'}
                            </p>
                        </div>
                        <Switch 
                            checked={settings.rectorEnabled} 
                            onCheckedChange={(v) => handleToggleSettings('rectorEnabled', v)}
                            disabled={isLoadingSettings || isUpdatingSettings}
                        />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="space-y-0.5">
                            <Label className="text-base font-semibold">Acceso Directores</Label>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {settings.directorEnabled ? <Unlock className="h-3 w-3 text-green-500" /> : <Lock className="h-3 w-3 text-red-500" />}
                                {settings.directorEnabled ? 'Habilitado' : 'Bloqueado'}
                            </p>
                        </div>
                        <Switch 
                            checked={settings.directorEnabled} 
                            onCheckedChange={(v) => handleToggleSettings('directorEnabled', v)}
                            disabled={isLoadingSettings || isUpdatingSettings}
                        />
                    </div>
                    {isUpdatingSettings && <p className="text-[10px] text-center text-primary animate-pulse">Actualizando configuración global...</p>}
                </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-6">
                <Tabs defaultValue="reports" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 h-11">
                    <TabsTrigger value="reports" className="flex items-center gap-2">
                    <Download className="h-4 w-4" /> Reportes
                    </TabsTrigger>
                    <TabsTrigger value="users" className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> Usuarios
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="reports">
                    <Card className="shadow-lg">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl font-bold text-primary">Reportes Consolidados</CardTitle>
                            <CardDescription>Archivos .xlsx generados por mes.</CardDescription>
                        </div>
                        <Button variant="outline" size="icon" onClick={fetchReports} disabled={isLoadingReports}>
                            <RefreshCw className={`h-4 w-4 ${isLoadingReports ? 'animate-spin' : ''}`} />
                        </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingReports ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : reports.length > 0 ? (
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Mes</TableHead>
                                <TableHead className="text-right">Descargar</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {reports.map((name) => (
                                <TableRow key={name}>
                                <TableCell className="font-semibold capitalize">{getFormattedMonth(name)}</TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" variant="ghost" onClick={() => handleDownload(name)} disabled={downloadingFile === name}>
                                    {downloadingFile === name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    </Button>
                                </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                        ) : (
                        <div className="text-center py-10 border border-dashed rounded-lg bg-muted/20">
                            <p className="text-muted-foreground text-sm">No hay reportes disponibles.</p>
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
                            <CardTitle className="text-xl font-bold text-primary">Directorio de Usuarios</CardTitle>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={handleSyncUsers} disabled={isSyncing} className="gap-2">
                            <FileSpreadsheet className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            Sync
                            </Button>
                            
                            <Dialog open={isUserDialogOpen} onOpenChange={(open) => { setIsUserDialogOpen(open); if(!open) setIsEditingUser(null); }}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nuevo</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <form onSubmit={handleSaveUser}>
                                <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-primary">{isEditingUser ? 'Editar Usuario' : 'Crear Usuario'}</DialogTitle>
                                </DialogHeader>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6">
                                <div className="space-y-2">
                                    <Label>Rol</Label>
                                    <Select name="role" defaultValue={isEditingUser?.role || 'rector'} onValueChange={(v) => setIsEditingUser(prev => prev ? {...prev, role: v as any} : {role: v as any} as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="rector">Rector</SelectItem>
                                        <SelectItem value="director">Director de Núcleo</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Nombre</Label>
                                    <Input name="name" defaultValue={isEditingUser?.name} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input name="email" type="email" defaultValue={isEditingUser?.email} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Contraseña</Label>
                                    <Input name="password" type="text" defaultValue={isEditingUser?.password} required />
                                </div>
                                
                                {(isEditingUser?.role === 'rector' || !isEditingUser?.role) && (
                                    <>
                                    <div className="space-y-2">
                                        <Label>Código DANE</Label>
                                        <Input name="dane" defaultValue={isEditingUser?.dane} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Institución</Label>
                                        <Input name="institution" defaultValue={isEditingUser?.institution} />
                                    </div>
                                    </>
                                )}
                                
                                {isEditingUser?.role === 'director' && (
                                    <div className="space-y-2 col-span-full">
                                        <Label>DANE Autorizados (Comas)</Label>
                                        <Input name="daneCodes" defaultValue={isEditingUser?.daneCodes?.join(', ')} />
                                    </div>
                                )}
                                </div>
                                <DialogFooter>
                                <Button type="submit" className="w-full">Guardar Cambios</Button>
                                </DialogFooter>
                                </form>
                            </DialogContent>
                            </Dialog>
                        </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingUsers ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : (
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Nombre / Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.email}>
                                <TableCell>
                                    <div className="font-semibold text-sm">{user.name}</div>
                                    <div className="text-xs text-muted-foreground">{user.email}</div>
                                </TableCell>
                                <TableCell>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${user.role === 'rector' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                        {user.role}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setIsEditingUser(user); setIsUserDialogOpen(true); }}>
                                            <Shield className="h-3 w-3 text-blue-500" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDeleteUser(user.email)}>
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                    </div>
                                </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                        )}
                    </CardContent>
                    </Card>
                </TabsContent>
                </Tabs>
            </div>
        </div>
      </main>
    </div>
  );
}
