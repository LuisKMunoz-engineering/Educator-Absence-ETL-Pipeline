'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogOut, Loader2, Download, List, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { listReports } from "@/ai/flows/list-reports-flow";
import { downloadReport, DownloadReportInput } from "@/ai/flows/download-report-flow";

export default function DownloadsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [reports, setReports] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const result = await listReports();
      if (result.success && result.reports) {
        setReports(result.reports);
      } else {
        throw new Error(result.error || "No se pudieron cargar los reportes.");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al Cargar",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDownload = async (fileName: string) => {
    setDownloadingFile(fileName);
    try {
      const input: DownloadReportInput = { fileName };
      const result = await downloadReport(input);

      if (result.success && result.fileContent && result.fileName) {
        // Create a link to download the file
        const link = document.createElement('a');
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.fileContent}`;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({
          title: "Descarga Exitosa",
          description: `El archivo ${result.fileName} ha comenzado a descargarse.`,
        });
      } else {
        throw new Error(result.error || "No se pudo descargar el archivo.");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de Descarga",
        description: error.message,
      });
    } finally {
      setDownloadingFile(null);
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
        </div>
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl font-bold text-primary font-headline">Descarga de Reportes</CardTitle>
                <CardDescription>Aquí puede descargar los reportes de ausentismo consolidados por mes.</CardDescription>
              </div>
              <Button variant="outline" size="icon" onClick={fetchReports} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : reports.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes del Reporte</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((reportName) => (
                    <TableRow key={reportName}>
                      <TableCell className="font-medium capitalize">
                        {getFormattedMonth(reportName)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleDownload(reportName)}
                          disabled={downloadingFile === reportName}
                        >
                          {downloadingFile === reportName ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
                          Descargar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-10 px-4 border border-dashed rounded-lg">
                <List className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No Hay Reportes Disponibles</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Aún no se ha generado ningún reporte de ausentismo. Los reportes aparecerán aquí una vez que sean enviados por los rectores.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
