import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import Footer from './Footer';

/**
 * Páginas legales públicas: sin navbar principal; enlace a inicio o al panel si hay sesión.
 */
const LegalDocumentLayout = ({ title, children }) => {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-muted/50 to-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="text-sm font-bold text-foreground">
            Slot Collection Pro
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard">Ir al panel</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/login">Iniciar sesión</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-16">
        <article className="space-y-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {children}
        </article>
      </main>

      <Footer />
    </div>
  );
};

export default LegalDocumentLayout;
