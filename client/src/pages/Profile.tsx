import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useVehicles } from "@/hooks/useVehicles";
import { useAdaptiveUI } from "@/contexts/AdaptiveUIContext";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { put, post, handleApiError } from "@/lib/apiUtils";
import { queryClient } from "@/lib/queryClient";
import { User, Car, Bell, Camera, Phone, Mail, MapPin, Plus, Shield } from "lucide-react";
import AccountSecurity from "@/components/AccountSecurity";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  bio: string;
}

const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const NOTIFICATION_OPTIONS = [
  { key: "maintenance", label: "Lembretes de Manutenção", text: "Notificações sobre manutenções programadas" },
  { key: "fuel", label: "Alertas de Combustível", text: "Avisos relacionados com abastecimentos e consumo" },
  { key: "expenses", label: "Despesas", text: "Resumos e avisos sobre despesas" },
  { key: "recommendations", label: "Recomendações", text: "Sugestões para poupar e manter o veículo" },
] as const;

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: vehicles = [] } = useVehicles();
  const { preferences, updatePreferences } = useAdaptiveUI();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    bio: ""
  });

  const resetForm = () => {
    if (!user) return;
    setProfileData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      address: user.address || "",
      bio: user.bio || ""
    });
  };

  useEffect(resetForm, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await put('/api/user/profile', profileData);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Perfil atualizado", description: "As suas informações foram guardadas com sucesso!" });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: handleApiError(error, "Não foi possível guardar as alterações"),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Erro", description: "Apenas são permitidas imagens JPEG, PNG ou WebP", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Erro", description: "O ficheiro deve ter menos de 5MB", variant: "destructive" });
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('profileImage', file);
      await post('/api/user/profile-image', formData);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Foto atualizada", description: "A sua foto de perfil foi atualizada com sucesso!" });
    } catch (error) {
      toast({
        title: "Erro",
        description: handleApiError(error, "Não foi possível atualizar a foto de perfil"),
        variant: "destructive"
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const field = (key: keyof ProfileData) => ({
    id: key,
    value: profileData[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setProfileData(prev => ({ ...prev, [key]: e.target.value })),
    disabled: !isEditing,
  });

  return (
    <Sidebar>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-white">
                  <AvatarImage src={user?.profileImageUrl || "/api/placeholder/96/96"} alt="Foto de perfil" />
                  <AvatarFallback className="text-2xl bg-blue-500">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <input
                  type="file"
                  id="profile-photo-upload"
                  accept={PROFILE_IMAGE_TYPES.join(",")}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button
                  size="sm"
                  className="absolute -bottom-2 -right-2 rounded-full h-8 w-8 p-0"
                  variant="secondary"
                  onClick={() => document.getElementById('profile-photo-upload')?.click()}
                  disabled={uploadingPhoto}
                  aria-label="Alterar foto de perfil"
                  title="Alterar foto de perfil"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold break-words">
                  {profileData.firstName} {profileData.lastName}
                </h1>
                <p className="text-blue-100 mt-1 break-all">{profileData.email}</p>
                {user?.createdAt && (
                  <Badge variant="secondary" className="mt-2">
                    Membro desde {new Date(user.createdAt).getFullYear()}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              onClick={() => {
                if (isEditing) resetForm();
                setIsEditing(!isEditing);
              }}
              variant={isEditing ? "outline" : "default"}
              className="self-start sm:self-auto"
            >
              {isEditing ? "Cancelar" : "Editar Perfil"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="personal" className="flex items-center gap-2 shrink-0">
              <User className="h-4 w-4" aria-hidden="true" />
              <span>Pessoal</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="flex items-center gap-2 shrink-0">
              <Car className="h-4 w-4" aria-hidden="true" />
              <span>Veículos</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 shrink-0">
              <Bell className="h-4 w-4" aria-hidden="true" />
              <span>Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 shrink-0">
              <Shield className="h-4 w-4" aria-hidden="true" />
              <span>Segurança</span>
            </TabsTrigger>
          </TabsList>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nome</Label>
                    <Input {...field("firstName")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apelido</Label>
                    <Input {...field("lastName")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input type="email" {...field("email")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input type="tel" {...field("phone")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Morada</Label>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input {...field("address")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Sobre mim</Label>
                  <Textarea {...field("bio")} placeholder="Conte um pouco sobre si..." rows={4} />
                </div>

                {isEditing && (
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={() => { resetForm(); setIsEditing(false); }}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveProfile} disabled={saving}>
                      {saving ? "A guardar..." : "Guardar Alterações"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vehicles Tab */}
          <TabsContent value="vehicles" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <CardTitle>Os Meus Veículos</CardTitle>
                <Button size="sm" className="self-start sm:self-auto" asChild>
                  <Link href="/dashboard">
                    <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                    Adicionar Veículo
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {vehicles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum veículo registado.</p>
                    <p className="text-sm">Adicione um veículo a partir do Dashboard.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vehicles.map((v) => (
                      <div key={v.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                            {v.imageUrl ? (
                              <img src={v.imageUrl} alt={`${v.brand} ${v.model}`} className="h-full w-full object-cover" />
                            ) : (
                              <Car className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{v.brand} {v.model} {v.year}</h3>
                            <p className="text-sm text-muted-foreground">Matrícula: {v.licensePlate || '-'}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/vehicle/${v.id}`}>Ver detalhes</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {NOTIFICATION_OPTIONS.map(({ key, label, text }, i) => (
                  <div key={key}>
                    {i > 0 && <Separator className="mb-6" />}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label htmlFor={`notif-${key}`}>{label}</Label>
                        <p className="text-sm text-muted-foreground">{text}</p>
                      </div>
                      <Switch
                        id={`notif-${key}`}
                        checked={preferences.notificationPreferences[key]}
                        onCheckedChange={(checked) =>
                          updatePreferences({
                            notificationPreferences: { ...preferences.notificationPreferences, [key]: checked },
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <AccountSecurity />
          </TabsContent>
        </Tabs>
      </div>
    </Sidebar>
  );
}
