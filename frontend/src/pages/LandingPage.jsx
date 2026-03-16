import React from 'react';
import { Link } from 'react-router-dom';
import { Car, TrendingUp, Trophy, Users, Clock, Settings, Sun, Moon } from 'lucide-react';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';

const features = [
  { icon: Car, title: 'Gestión de Colección', description: 'Catálogo completo de tus coches Scalextric con fotos, especificaciones técnicas y detalles de modificación.', color: 'text-violet-500' },
  { icon: TrendingUp, title: 'Estadísticas Avanzadas', description: 'Análisis detallado de tu colección, inversiones, distribución por marcas y evolución temporal.', color: 'text-green-500' },
  { icon: Trophy, title: 'Sistema de Competiciones', description: 'Organiza competiciones profesionales con múltiples rondas, cronometraje automático y rankings en vivo.', color: 'text-amber-500' },
  { icon: Users, title: 'Gestión de Participantes', description: 'Inscripciones públicas, gestión de equipos y seguimiento individual de cada piloto.', color: 'text-pink-500' },
  { icon: Clock, title: 'Cronometraje Preciso', description: 'Sistema de tiempos por vuelta, mejores vueltas y penalizaciones con precisión de milisegundos.', color: 'text-cyan-500' },
  { icon: Settings, title: 'Configuración Avanzada', description: 'Personaliza reglas de competición, categorías y configuraciones específicas para cada evento.', color: 'text-gray-500' },
];

const LandingPage = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-muted/50 to-background">
      {/* Theme toggle solo en landing para usuarios no logueados */}
      <div className="absolute right-4 top-4 z-20">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>

      <section className="flex-1 flex items-center justify-center px-4 py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.1)_0%,transparent_50%)] bg-[radial-gradient(circle_at_80%_20%,rgba(255,119,198,0.1)_0%,transparent_50%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between max-w-6xl mx-auto w-full gap-12">
          <div className="flex-1 max-w-xl text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Slot Collection Pro
              </span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Plataforma profesional para gestionar tu colección de coches de Slot y organizar competiciones de alto nivel.
            </p>
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
              <Button asChild size="lg">
                <Link to="/login">Iniciar Sesión</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login?register=true">Registrarse</Link>
              </Button>
            </div>
          </div>
          <div className="flex gap-4">
            {[
              { icon: Car, label: 'Colección' },
              { icon: Trophy, label: 'Competiciones' },
              { icon: TrendingUp, label: 'Estadísticas' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center w-24 h-24 rounded-xl border bg-card shadow-md hover:shadow-lg transition-shadow"
              >
                <item.icon className="size-8 text-primary mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Todo lo que necesitas para tu pasión por el{' '}
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Slot
              </span>
            </h2>
            <p className="text-muted-foreground">
              Una plataforma completa diseñada para entusiastas y organizadores de competiciones
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow">
                <div className={`mb-4 ${f.color}`}>
                  <f.icon className="size-10" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">¿Listo para empezar?</h2>
          <p className="text-muted-foreground mb-6">
            Únete a la comunidad de entusiastas del Slot y lleva tu pasión al siguiente nivel
          </p>
          <Button asChild size="lg">
            <Link to="/login">Comenzar Ahora</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
