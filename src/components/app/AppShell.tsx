"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, Settings, LogOut, Menu, X,
  Plane, Bell, ChevronLeft, Moon, Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const onlyLogo = "/onfly-new.svg";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Itinerários", end: true },
  { href: "/calendar", icon: Calendar, label: "Agenda", end: false },
  { href: "/settings", icon: Settings, label: "Preferências", end: false },
];

interface AppShellProps {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
}

export function AppShell({ children, userName, userEmail }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  const isActive = (href: string, end: boolean) =>
    end ? pathname === href : pathname.startsWith(href);

  const initials = userName
    .split(" ")
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden">
      {/* Sidebar — Desktop */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border/50 bg-card transition-all duration-300 shrink-0 h-screen sticky top-0 overflow-y-auto",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        <div className={cn("h-16 flex items-center border-b border-border/50 px-3 gap-2", collapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-2 min-w-0">
            <img src={onlyLogo} alt="Onfly" className="h-7 shrink-0" />
            {!collapsed && <span className="font-semibold text-sm tracking-tight text-primary">OnTime</span>}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href, item.end);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all duration-200 group",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <item.icon className={cn("w-[18px] h-[18px] shrink-0", active && "text-primary")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/50 p-3">
          <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "gap-3")}>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-[280px] bg-card border-r border-border/50 flex flex-col animate-fade-in-left">
            <div className="h-16 flex items-center justify-between px-5 border-b border-border/50">
              <div className="flex items-center gap-2">
                <img src={onlyLogo} alt="Onfly" className="h-7" />
                <span className="font-semibold text-sm text-primary">OnTime</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.href, item.end);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("w-[18px] h-[18px]", active && "text-primary")} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border/50 p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
                </div>
                <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground transition-colors" title="Sair">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-border/50 bg-background/80 backdrop-blur-xl shrink-0 sticky top-0 z-40">
          <button className="lg:hidden text-muted-foreground" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            <Plane className="w-4 h-4" />
            <span>Assistente de Viagens Corporativas</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title={darkMode ? "Modo claro" : "Modo escuro"}
            >
              {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <button className="relative p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
              <Bell className="w-[18px] h-[18px]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
