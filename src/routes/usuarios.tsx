import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, KeyRound, UserPlus, ShieldOff, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Controle Albras" }] }),
  component: () => (
    <AppShell>
      <UsuariosPage />
    </AppShell>
  ),
});

interface ManagedUser {
  id: string;
  full_name: string | null;
  email: string | null;
  blocked: boolean;
  roles: string[];
  created_at: string;
}

const createSchema = z.object({
  full_name: z.string().trim().min(2, "Nome obrigatório").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  role: z.enum(["admin", "operador", "diretoria"]),
});

function UsuariosPage() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error("Acesso restrito a administradores.");
      navigate({ to: "/" });
    }
  }, [authLoading, isAdmin, navigate]);

  const invoke = useCallback(async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: payload });
    if (error) throw error;
    if (data && typeof data === "object" && "error" in data && (data as any).error) {
      throw new Error((data as any).error);
    }
    return data as any;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoke({ action: "list" });
      setUsers(res.users ?? []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = createSchema.safeParse({
      full_name: fd.get("full_name"),
      email: fd.get("email"),
      password: fd.get("password"),
      role: fd.get("role"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setCreating(true);
    try {
      await invoke({ action: "create", ...parsed.data });
      toast.success("Usuário criado com sucesso.");
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleBlock(u: ManagedUser) {
    if (!confirm(`${u.blocked ? "Desbloquear" : "Bloquear"} ${u.full_name || u.email}?`)) return;
    setBusyId(u.id);
    try {
      await invoke({ action: "set_blocked", user_id: u.id, blocked: !u.blocked });
      toast.success(u.blocked ? "Usuário desbloqueado." : "Usuário bloqueado.");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function sendReset(u: ManagedUser) {
    if (!u.email) return;
    setBusyId(u.id);
    try {
      await invoke({
        action: "send_reset",
        email: u.email,
        redirect_to: `${window.location.origin}/reset-password`,
      });
      toast.success("E-mail de recuperação enviado.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(u: ManagedUser) {
    if (!confirm(`Excluir definitivamente ${u.full_name || u.email}? Esta ação não pode ser desfeita.`)) return;
    setBusyId(u.id);
    try {
      await invoke({ action: "delete", user_id: u.id });
      toast.success("Usuário excluído.");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || !isAdmin) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
        Verificando permissões...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold">Gestão de usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crie contas, bloqueie acessos e envie link de recuperação de senha.
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" /> Criar novo usuário
          </CardTitle>
          <CardDescription>
            O usuário receberá acesso imediato com a senha definida abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha inicial</Label>
              <Input id="password" name="password" type="text" minLength={8} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Papel</Label>
              <Select name="role" defaultValue="operador">
                <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="diretoria">Diretoria</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar usuário
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Usuários cadastrados</CardTitle>
          <CardDescription>{users.length} usuário(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">E-mail</th>
                    <th className="py-2 pr-4">Papel</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === user?.id;
                    const busy = busyId === u.id;
                    return (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">
                          {u.full_name || "—"} {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{u.email}</td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length
                              ? u.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)
                              : <Badge variant="outline">sem papel</Badge>}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          {u.blocked
                            ? <Badge variant="destructive">Bloqueado</Badge>
                            : <Badge className="bg-success/10 text-success border-success/20" variant="secondary">Ativo</Badge>}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" disabled={busy || !u.email} onClick={() => sendReset(u)} title="Enviar link de recuperação">
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" disabled={busy || isSelf} onClick={() => toggleBlock(u)} title={u.blocked ? "Desbloquear" : "Bloquear"}>
                              {u.blocked ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="outline" disabled={busy || isSelf} onClick={() => removeUser(u)} title="Excluir">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum usuário</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
