"use client"

import { useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Upload, X, FileText, CheckCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface DocumentUploadProps {
    bucketName?: string
    folder?: string
    onUploadComplete: (url: string) => void
    label?: string
    accept?: string
    className?: string
}

export function DocumentUpload({
    bucketName = "documentos",
    folder = "uploads",
    onUploadComplete,
    label = "Subir documento PDF",
    accept = ".pdf",
    className,
}: DocumentUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [fileUrl, setFileUrl] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true)
            const file = event.target.files?.[0]
            if (!file) return

            const fileExt = file.name.split(".").pop()
            const fileName = `${folder}/${Math.random().toString(36).substring(2, 15)}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filePath, file)

            if (uploadError) {
                throw uploadError
            }

            const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)

            setFileUrl(data.publicUrl)
            onUploadComplete(data.publicUrl)
            toast.success("Documento subido correctamente")
        } catch (error) {
            console.error("Error uploading document:", error)
            toast.error("Error al subir el documento")
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }
    }

    const clearFile = () => {
        setFileUrl(null)
        onUploadComplete("")
    }

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <div className="flex items-center gap-4">
                <input
                    type="file"
                    id="document-upload"
                    className="hidden"
                    accept={accept}
                    onChange={handleUpload}
                    disabled={uploading}
                    ref={fileInputRef}
                />

                {!fileUrl ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto gap-2 border-dashed"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="h-4 w-4" />
                        )}
                        {uploading ? "Subiendo..." : label}
                    </Button>
                ) : (
                    <div className="flex items-center gap-2 p-2 px-3 bg-muted/50 rounded-lg border border-border flex-1 min-w-0">
                        <div className="p-1.5 bg-background rounded-md border border-border shadow-sm">
                            <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="text-xs font-medium truncate text-foreground">Documento cargado</span>
                            <CheckCircle className="h-3 w-3 text-green-500" />
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
                            onClick={clearFile}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                )}
            </div>
            {fileUrl && (
                <p className="text-[10px] text-muted-foreground truncate px-1">
                    {fileUrl}
                </p>
            )}
        </div>
    )
}
