"use client";

import Link from "next/link";
import { Clock, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  userName?: string;
  showNav?: boolean;
}

export function Navbar({ userName, showNav = false }: NavbarProps) {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-onfly">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            On<span className="text-gradient-onfly">Time</span>
          </span>
        </Link>

        {showNav && (
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Itinerarios
            </Link>
            <Link
              href="/onboarding"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              <Settings className="inline h-4 w-4 mr-1" />
              Preferencias
            </Link>

            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <span className="text-sm text-muted">{userName}</span>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
