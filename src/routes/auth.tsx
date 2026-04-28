import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acessar — Controle Diário Albras" },
      { name: "description", content: "Acesso ao sistema de controle diário Albras." },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    // Check blocked flag
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("blocked")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile?.blocked) {
        await supabase.auth.signOut();
        setBusy(false);
        return toast.error("Sua conta está bloqueada. Contate o administrador.");
      }
    }
    setBusy(false);
    toast.success("Bem-vindo!");
    navigate({ to: "/" });
  }

  async function handleForgot() {
    const email = (document.getElementById("login-email") as HTMLInputElement | null)?.value?.trim();
    if (!email) return toast.error("Informe seu e-mail no campo acima primeiro.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Controle Diário Albras</h1>
          <p className="mt-1 text-sm text-muted-foreground">CTR 4600009749 — Acesso restrito</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-elegant">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">E-mail</Label>
              <Input id="login-email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
            <button
              type="button"
              onClick={handleForgot}
              className="block w-full text-center text-xs text-muted-foreground hover:text-primary"
            >
              Esqueci minha senha
            </button>
          </form>
          <p className="mt-6 text-xs text-muted-foreground text-center">
            Novas contas são criadas apenas pelo administrador.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Voltar</Link>
        </p>
      </div>
    </div>
  );
}
