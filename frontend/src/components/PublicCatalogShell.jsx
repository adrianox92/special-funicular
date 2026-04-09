import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import Footer from './Footer';

/**
 * Cabecera mínima para páginas públicas del catálogo (sin Navbar autenticado).
 */
export default function PublicCatalogShell({ children }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link to="/" className="font-semibold text-foreground truncate hover:opacity-90">
              Slot Collection Pro
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <Link to="/catalogo" className="hover:text-foreground transition-colors">
                Catálogo
              </Link>
              {user && (
                <>
                  <Link to="/mis-sugerencias-catalogo" className="hover:text-foreground transition-colors">
                    Mis sugerencias
                  </Link>
                  <Link to="/proponer-alta-catalogo" className="hover:text-foreground transition-colors">
                    Proponer alta
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard">Panel</Link>
              </Button>
            ) : (
              <Button variant="default" size="sm" asChild>
                <Link to="/login">Iniciar sesión</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
