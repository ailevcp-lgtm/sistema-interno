"use client"

import { useState } from "react"
import Link from "next/link"
import { Bell, Check, Trash, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import { useNotificaciones } from "@/hooks/useNotificaciones"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { TipoNotificacion } from "@/lib/types"

const iconMap: Record<TipoNotificacion, React.ElementType> = {
    info: Info,
    alerta: AlertTriangle,
    exito: CheckCircle,
    error: XCircle,
}

const colorMap: Record<TipoNotificacion, string> = {
    info: "text-blue-500",
    alerta: "text-yellow-500",
    exito: "text-green-500",
    error: "text-red-500",
}

export function NotificationsPopover() {
    const [open, setOpen] = useState(false)
    const {
        notificaciones,
        loading,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification
    } = useNotificaciones()

    const handleNotificationClick = (id: string, link?: string) => {
        markAsRead(id)
        if (link) {
            setOpen(false)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="relative p-2 rounded-lg hover:bg-muted transition-colors outline-none focus:bg-muted">
                    <Bell className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.8} />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 sm:w-96 p-0" sideOffset={8}>
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold leading-none">Notificaciones</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAllAsRead()}
                            className="h-auto px-2 py-1 text-xs"
                        >
                            Marcar todas leídas
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[400px]">
                    {loading ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            Cargando...
                        </div>
                    ) : notificaciones.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-2">
                            <Bell className="w-8 h-8 opacity-20" />
                            <p className="text-sm">No tienes notificaciones</p>
                        </div>
                    ) : (
                        <div className="flex flex-col divide-y">
                            {notificaciones.map((notif) => {
                                const Icon = iconMap[notif.tipo] || Info
                                const colorClass = colorMap[notif.tipo] || "text-foreground"

                                return (
                                    <div
                                        key={notif.id}
                                        className={`group flex min-w-0 gap-3 p-4 transition-colors hover:bg-muted/50 ${!notif.leida ? "bg-muted/30" : ""
                                            }`}
                                    >
                                        <div className={`mt-0.5 ${colorClass}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`min-w-0 break-words text-sm font-medium leading-none ${!notif.leida ? "text-foreground" : "text-muted-foreground"}`}>
                                                    {notif.titulo}
                                                </p>
                                                <time className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                    {new Date(notif.created_at).toLocaleDateString()}
                                                </time>
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-snug break-words">
                                                {notif.mensaje}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                {!notif.leida && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2 text-[10px]"
                                                        onClick={() => markAsRead(notif.id)}
                                                    >
                                                        Marcar leída
                                                    </Button>
                                                )}
                                                {notif.link && (
                                                    <Link href={notif.link} passHref legacyBehavior>
                                                        <Button
                                                            variant="link"
                                                            size="sm"
                                                            className="h-6 px-0 text-[10px]"
                                                            onClick={() => handleNotificationClick(notif.id, notif.link)}
                                                        >
                                                            Ver detalle
                                                        </Button>
                                                    </Link>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => deleteNotification(notif.id)}
                                                >
                                                    <Trash className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                                                    <span className="sr-only">Eliminar</span>
                                                </Button>
                                            </div>
                                        </div>
                                        {!notif.leida && (
                                            <div className="mt-1.5">
                                                <span className="flex h-2 w-2 rounded-full bg-primary" />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}
