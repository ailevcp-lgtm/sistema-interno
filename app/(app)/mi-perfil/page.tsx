"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useSocios } from "@/hooks/useSocios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials, generateAvatarColor, formatDate } from "@/lib/utils"
import { Loader2, Mail, Phone, Calendar, BadgeCheck, Shield } from "lucide-react"

export default function MiPerfilPage() {
    const { user } = useAuth()
    const { socios } = useSocios()
    const [loading, setLoading] = useState(true)
    const [userData, setUserData] = useState<any>(null)

    useEffect(() => {
        if (user && socios.length > 0) {
            // Find socio record linked to this user
            // Note: This matches by email since usuario_id might not be linked in imported data yet
            const socio = socios.find(s => s.email === user.email || s.usuario_id === user.id)
            setUserData(socio || null)
            setLoading(false)
        } else if (user) {
            setLoading(false)
        }
    }, [user, socios])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!user) {
        return <div>No has iniciado sesión</div>
    }

    const initials = getInitials(user.nombre || userData?.nombre || '', user.apellido || userData?.apellido || '')
    const avatarColor = generateAvatarColor(user.id)

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Profile Card */}
                <Card className="flex-1 border-border">
                    <CardHeader>
                        <CardTitle>Mi Perfil</CardTitle>
                        <CardDescription>Gestiona tu información personal</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-center gap-4 py-4">
                            <Avatar className={`w-24 h-24 bg-gradient-to-br ${avatarColor}`}>
                                <AvatarImage src={user.avatar_url} />
                                <AvatarFallback className="text-2xl font-bold text-white bg-transparent">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-center">
                                <h2 className="text-xl font-semibold">
                                    {user.nombre} {user.apellido}
                                </h2>
                                <p className="text-muted-foreground">{user.email}</p>
                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary">
                                        {userData?.rol_aile || 'Socio'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nombre</label>
                                <Input value={user.nombre} disabled />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Apellido</label>
                                <Input value={user.apellido} disabled />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input value={user.email} disabled className="pl-9" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Rol de Sistema</label>
                                <div className="relative">
                                    <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input value={user.rol} disabled className="pl-9 capitalize" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Socio Info Card */}
                <Card className="flex-1 border-border">
                    <CardHeader>
                        <CardTitle>Datos de Socio</CardTitle>
                        <CardDescription>Información registrada en AILE</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {userData ? (
                            <div className="space-y-6">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">DNI</label>
                                        <div className="relative">
                                            <BadgeCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input value={userData.dni} disabled className="pl-9" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Teléfono</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input value={userData.telefono || '-'} disabled className="pl-9" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Fecha de Ingreso</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input value={formatDate(userData.fecha_ingreso)} disabled className="pl-9" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Estado</label>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${userData.estado === 'activo' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                            <span className="capitalize">{userData.estado}</span>
                                        </div>
                                    </div>
                                </div>

                                {userData.tiene_deuda && (
                                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4">
                                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                                            Tienes cuotas pendientes de pago. Por favor, revisa tu estado de cuenta.
                                        </p>
                                        <Button variant="link" className="text-red-600 dark:text-red-400 p-0 h-auto mt-2 font-semibold">
                                            Ver mi cuenta &rarr;
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground">
                                    No se encontró información de socio asociada a tu cuenta.
                                    <br />
                                    Si crees que es un error, contacta a un administrador.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
