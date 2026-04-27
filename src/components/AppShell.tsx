import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, ClipboardEdit, History, Factory, Clock, DollarSign, Upload } from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lancamentos", label: "Produção", icon: ClipboardEdit },
  { to: "/horas", label: "Horas M.O.", icon: Clock },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/importar", label: "Importar", icon: Upload },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, fullName, roles, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Redirecionando...
      </div>
    );
  }

  const initials = (fullName || user.email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b bg-card/85 backdrop-blur shadow-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex h-16 items-center gap-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant">
              <Factory className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-semibold">Controle Diário Albras</div>
              <div className="text-xs text-muted-foreground">CTR 4600009749</div>
            </div>
          </Link>

          <nav className="ml-6 hidden md:flex items-center gap-1">
            {NAV.map((item) => {
              const active = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right leading-tight">
                <div className="text-sm font-medium">{fullName || user.email}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {roles.length > 0 ? roles.join(" · ") : "sem papel"}
                </div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                {initials}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Sair</span>
            </Button>
          </div>
        </div>

        <nav className="md:hidden border-t bg-card">
          <div className="mx-auto max-w-7xl px-2 flex">
            {NAV.map((item) => {
              const active = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex-1 inline-flex flex-col items-center gap-1 px-2 py-2 text-xs font-medium ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">{children}</div>
      </main>

      <footer className="border-t bg-card/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 text-xs text-muted-foreground flex justify-between">
          <span>Albras · Período de fechamento dia 16 ao 15</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
