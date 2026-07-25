'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogOut, Loader2, Download, List, RefreshCw, Users, Shield, Trash2, Plus, Save } from "lucide-react";
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
      // First sync if empty (handled in the flow)
      await syncFromExcel();
      const result = await getUsers();
      setUsers(result);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al Cargar Usuarios", description: error.message });
    } finally {
      setIsLoadingUsers(false);
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
        email: formData.get('email') as string,
        password: formData.get('password') as string,
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
        toast({ title: "Usuario Guardado", description: "El usuario ha sido actualizado correctamente." });
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
          <Image src="/EscudoSedCaucaB.png" alt="Escudo SED Cauca" width={80} height={80} />
          <h2 className="ml-4 text-xl font-bold text-primary hidden md:block">Panel de Administración</h2>
        </div>
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-6xl mx-auto">
        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Reportes Consolidados
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Gestión de Usuarios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl font-bold text-primary font-headline">Descarga de Reportes</CardTitle>
                    <CardDescription>Descargue los archivos consolidados de ausentismo.</CardDescription>
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
                        <TableHead>Mes del Reporte</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((name) => (
                        <TableRow key={name}>
                          <TableCell className="font-medium capitalize">{getFormattedMonth(name)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => handleDownload(name)} disabled={downloadingFile === name}>
                              {downloadingFile === name ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                              Descargar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-10 border border-dashed rounded-lg">
                    <List className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">No hay reportes disponibles.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl font-bold text-primary font-headline">Gestión de Usuarios</CardTitle>
                    <CardDescription>Cree y administre las cuentas de Rectores y Directores.</CardDescription>
                  </div>
                  <div className="flex gap-2">
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
                          <DialogTitle>{isEditingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
                          <DialogDescription>Complete los datos del usuario.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-4 py-4">
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
                            <Label>Nombre Completo</Label>
                            <Input name="name" defaultValue={isEditingUser?.name} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Correo / Usuario</Label>
                            <Input name="email" type="text" defaultValue={isEditingUser?.email} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Contraseña</Label>
                            <Input name="password" type="text" defaultValue={isEditingUser?.password} required />
                          </div>
                          
                          {/* Conditional Fields */}
                          {(isEditingUser?.role === 'rector' || !isEditingUser?.role) && (
                            <>
                              <div className="space-y-2">
                                <Label>DANE</Label>
                                <Input name="dane" defaultValue={isEditingUser?.dane} />
                              </div>
                              <div className="space-y-2">
                                <Label>Establecimiento</Label>
                                <Input name="institution" defaultValue={isEditingUser?.institution} />
                              </div>
                              <div className="space-y-2">
                                <Label>Municipio</Label>
                                <Input name="municipality" defaultValue={isEditingUser?.municipality} />
                              </div>
                            </>
                          )}
                          
                          {isEditingUser?.role === 'director' && (
                            <>
                              <div className="space-y-2">
                                <Label>Cédula</Label>
                                <Input name="cedula" defaultValue={isEditingUser?.cedula} />
                              </div>
                              <div className="space-y-2 col-span-2">
                                <Label>Códigos DANE (separados por coma)</Label>
                                <Input name="daneCodes" defaultValue={isEditingUser?.daneCodes?.join(', ')} placeholder="1234, 5678, ..." />
                              </div>
                            </>
                          )}
                        </div>
                        <DialogFooter>
                          <Button type="submit" className="gap-2"><Save className="h-4 w-4" /> Guardar</Button>
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
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Institución / DANE</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.email}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell className="capitalize">{user.role}</TableCell>
                          <TableCell className="text-xs">
                            {user.role === 'rector' ? user.institution : `${user.daneCodes?.length || 0} Instituciones`}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="icon" variant="ghost" onClick={() => { setIsEditingUser(user); setIsUserDialogOpen(true); }}>
                              <Shield className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteUser(user.email)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
      </main>
    </div>
  );
}
