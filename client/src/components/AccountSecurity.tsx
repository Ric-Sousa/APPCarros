import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { KeyRound, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { del, put, handleApiError } from "@/lib/apiUtils";
import { queryClient } from "@/lib/queryClient";

/** Alterar a palavra-passe e eliminar a conta. */
export default function AccountSecurity() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const changePassword = useMutation({
    mutationFn: () => put("/api/user/password", { currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Palavra-passe alterada" });
    },
    onError: (error) => toast({ title: "Erro", description: handleApiError(error), variant: "destructive" }),
  });

  const deleteAccount = useMutation({
    mutationFn: () => del("/api/user", { password: deletePassword }),
    onSuccess: () => {
      localStorage.removeItem("token");
      queryClient.clear();
      navigate("/");
      toast({ title: "Conta eliminada", description: "Todos os seus dados foram apagados." });
    },
    onError: (error) => toast({ title: "Erro", description: handleApiError(error), variant: "destructive" }),
  });

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Palavra-passe demasiado curta", description: "Use pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "As palavras-passe não coincidem", variant: "destructive" });
      return;
    }
    changePassword.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" aria-hidden="true" /> Alterar Palavra-passe</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitPassword} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="current-password">Palavra-passe atual</Label>
              <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova palavra-passe</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova palavra-passe</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? "A guardar..." : "Alterar palavra-passe"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" aria-hidden="true" /> Eliminar Conta</CardTitle>
          <CardDescription>Apaga a conta, os veículos, os registos e os ficheiros enviados. Não pode ser desfeito.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Eliminar a minha conta</Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeletePassword(""); }}
        title="Eliminar a conta?"
        description="Todos os seus dados serão apagados definitivamente. Confirme com a sua palavra-passe."
        confirmLabel="Eliminar definitivamente"
        onConfirm={() => deleteAccount.mutate()}
        pending={deleteAccount.isPending}
      >
        <div className="space-y-2">
          <Label htmlFor="delete-password">Palavra-passe</Label>
          <Input id="delete-password" type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
        </div>
      </ConfirmDialog>
    </div>
  );
}
