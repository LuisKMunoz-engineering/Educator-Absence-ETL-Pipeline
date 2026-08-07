'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { UploadCloud, FileText, X } from 'lucide-react';
import { Button } from './ui/button';

interface FileUploaderProps {
  onFileChange: (file: File | null) => void;
  acceptedFileTypes?: string[];
  file: File | null;
}

export function FileUploader({ onFileChange, acceptedFileTypes, file }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileChange(files[0]);
    }
  }, [onFileChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileChange(files[0]);
    }
  };

  if (file) {
    return (
        <div className="relative flex items-center p-4 bg-muted/50 rounded-lg border border-dashed">
            <FileText className="h-8 w-8 text-primary mr-4" />
            <div className="flex-grow">
                <p className="font-semibold text-sm truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onFileChange(null)} className="h-8 w-8 rounded-full hover:bg-destructive/20 text-destructive">
                <X className="h-5 w-5" />
            </Button>
        </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
        isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
      )}
    >
        <label htmlFor="file-upload" className="w-full text-center cursor-pointer">
            <div className="flex flex-col items-center justify-center">
                <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">Haga clic para cargar</span> o arrastre y suelte
                </p>
                <p className="text-xs text-muted-foreground">
                    XLSX, XLSM
                </p>
            </div>
        </label>
        <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept={acceptedFileTypes?.join(',')} />
    </div>
  );
}
