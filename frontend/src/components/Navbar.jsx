import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Trophy,
  Car,
  Clock,
  Flag,
  Package,
  User,
  LogOut,
  Settings,
  Home,
  Menu,
  Sun,
  Moon,
  Shield,
  CircleHelp,
  Search,
  Database,
  Store,
  Building2,
} from 'lucide-react';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import api from '../lib/axios';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { cn } from '../lib/utils';
import { useCommandPalette } from '../context/CommandPaletteContext';

function NavbarSearchTrigger({ className, onOpen }) {
  const [modKey, setModKey] = React.useState('Ctrl');

  useEffect(() => {
    setModKey(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '⌘' : 'Ctrl');
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex h-9 w-full max-w-full min-w-0 items-center gap-2 rounded-md border border-input bg-background/90 px-3 text-left text-sm text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent/60 hover:text-accent-foreground',
        className,
      )}
      aria-label="Abrir búsqueda rápida"
    >
      <Search className="size-4 shrink-0 opacity-60" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        Buscar vehículos, circuitos, inventario…
      </span>
      <span className="pointer-events-none hidden shrink-0 items-center gap-0.5 sm:inline-flex" aria-hidden>
        <kbd className="rounded border border-border bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          {modKey}
        </kbd>
        <kbd className="rounded border border-border bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          K
        </kbd>
      </span>
    </button>
  );
}

const Navbar = () => {
  const { user, logout } = useAuth();
  const { setOpen: openCommandPalette } = useCommandPalette();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  /** Solo usuarios con fila en seller_profiles (pendiente, aprobada o rechazada). */
  const [hasSellerProfile, setHasSellerProfile] = useState(false);
  const navbarRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setHasSellerProfile(false);
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await api.get('/store-listings/my/profile');
        if (!cancelled) setHasSellerProfile(data != null && typeof data === 'object');
      } catch {
        if (!cancelled) setHasSellerProfile(false);
      }
    };
    load();
    const onSellerProfileChanged = () => {
      load();
    };
    window.addEventListener('slotdb-seller-profile-updated', onSellerProfileChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('slotdb-seller-profile-updated', onSellerProfileChanged);
    };
  }, [user]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getUserInitials = () => {
    if (!user?.email) return 'U';
    return user.email.charAt(0).toUpperCase();
  };

  const showLicenseAdmin = isLicenseAdminUser(user);

  const headerLogoSrc = `${process.env.PUBLIC_URL || ''}/${
    theme === 'dark' ? 'logo-header.png' : 'logo-header-dark.png'
  }`;

  const navItems = [
    { path: '/dashboard', label: 'Inicio', icon: Home },
    { path: '/vehicles', label: 'Vehículos', icon: Car },
    { path: '/timings', label: 'Tiempos', icon: Clock },
    { path: '/circuits', label: 'Circuitos', icon: Flag },
    { path: '/inventory', label: 'Inventario', icon: Package },
    { path: '/competitions', label: 'Competiciones', icon: Trophy },
    { path: '/clubs', label: 'Clubes', icon: Building2 },
    ...(hasSellerProfile
      ? [{ path: '/seller', label: 'Mis listados', icon: Store }]
      : []),
    { path: '/help', label: 'Ayuda', icon: CircleHelp },
  ];

  const NavLink = ({ item }) => {
    const Icon = item.icon;
    return (
      <Link
        to={item.path}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          isActive(item.path)
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Icon className="size-4" />
        {item.label}
      </Link>
    );
  };

  return (
    <header
      ref={navbarRef}
      className={cn(
        'fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-shadow',
        isScrolled && 'shadow-sm'
      )}
    >
      <div className="mx-auto flex h-16 w-full min-w-0 items-center gap-2 px-4 sm:px-6 lg:gap-3 lg:px-8">
        <Link
          to={user ? '/dashboard' : '/'}
          onClick={(e) => {
            e.preventDefault();
            navigate(user ? '/dashboard' : '/');
          }}
          className="flex shrink-0 items-center"
        >
          <img
            key={headerLogoSrc}
            src={headerLogoSrc}
            alt="Slot Database"
            className="h-9 w-auto max-w-[min(100%,14rem)] object-contain object-left sm:max-w-[16rem]"
            decoding="async"
          />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex">
          {navItems.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </nav>

        <NavbarSearchTrigger
          onOpen={() => openCommandPalette(true)}
          className="hidden shrink-0 md:flex md:w-[clamp(9.5rem,min(18vw,18rem),18rem)] lg:w-[clamp(10rem,min(15vw,18rem),18rem)] 2xl:w-72"
        />

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 md:ml-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => openCommandPalette(true)}
            aria-label="Abrir búsqueda rápida"
          >
            <Search className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {user && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">Usuario</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                      <User className="size-4" />
                      Mi Perfil
                    </Link>
                  </DropdownMenuItem>
                  {hasSellerProfile && (
                    <DropdownMenuItem asChild>
                      <Link to="/seller" className="flex items-center gap-2 cursor-pointer">
                        <Store className="size-4" />
                        Mis listados
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {showLicenseAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin/slot-race-licenses" className="flex items-center gap-2 cursor-pointer">
                        <Shield className="size-4" />
                        Admin licencias SRM
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {showLicenseAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin/slot-catalog" className="flex items-center gap-2 cursor-pointer">
                        <Database className="size-4" />
                        Catálogo slot (admin)
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="size-4" />
                      Configuración
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="size-4" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {/* Mobile menu */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Abrir menú">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle>Menú</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 mt-6">
                {navItems.map((item) => (
                  <NavLink key={item.path} item={item} />
                ))}
                {showLicenseAdmin && (
                  <Link
                    to="/admin/slot-race-licenses"
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Shield className="size-4" />
                    Admin licencias SRM
                  </Link>
                )}
                {showLicenseAdmin && (
                  <Link
                    to="/admin/slot-catalog"
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Database className="size-4" />
                    Catálogo slot (admin)
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
