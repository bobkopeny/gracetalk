import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, MessageSquare, Users, LayoutDashboard, Shield, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navigation() {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/personas", label: "My Personas", icon: Users },
    { href: "/history", label: "History", icon: BookOpen },
  ];

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border hidden md:flex flex-col z-50">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl text-primary">GraceTalk</span>
        </div>

        <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold">
            {user?.firstName?.[0] || user?.email?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.firstName || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start gap-3" onClick={() => logout()}>
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </nav>
  );
}

export function MobileHeader() {
  const { logout } = useAuth();
  
  return (
    <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <Shield className="w-6 h-6 text-primary" />
        <span className="font-display font-bold text-lg text-primary">GraceTalk</span>
      </div>
      <Button size="sm" variant="ghost" onClick={() => logout()}>
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function MobileNav() {
  const [location] = useLocation();
  const navItems = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/personas", label: "Personas", icon: Users },
    { href: "/history", label: "History", icon: BookOpen },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-card border-t border-border z-50 px-4 pb-safe">
      <div className="flex justify-around py-3">
        {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    "flex flex-col items-center gap-1 transition-colors duration-200",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className={cn("w-6 h-6", isActive && "fill-current/20")} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
