import React from 'react';
import { Link } from 'react-router-dom';
import { Car, TrendingUp, Trophy, Users, Clock, Settings } from 'lucide-react';
import { Button } from '../components/ui/button';

const features = [
  { icon: Car, title: 'Gestión de Colección', description: 'Catálogo completo de tus coches Scalextric con fotos, especificaciones técnicas y detalles de modificación.', color: 'text-violet-500' },
  { icon: TrendingUp, title: 'Estadísticas Avanzadas', description: 'Análisis detallado de tu colección, inversiones, distribución por marcas y evolución temporal.', color: 'text-green-500' },
  { icon: Trophy, title: 'Sistema de Competiciones', description: 'Organiza competiciones profesionales con múltiples rondas, cronometraje automático y rankings en vivo.', color: 'text-amber-500' },
  { icon: Users, title: 'Gestión de Participantes', description: 'Inscripciones públicas, gestión de equipos y seguimiento individual de cada piloto.', color: 'text-pink-500' },
  { icon: Clock, title: 'Cronometraje Preciso', description: 'Sistema de tiempos por vuelta, mejores vueltas y penalizaciones con precisión de milisegundos.', color: 'text-cyan-500' },
  { icon: Settings, title: 'Configuración Avanzada', description: 'Personaliza reglas de competición, categorías y configuraciones específicas para cada evento.', color: 'text-gray-500' },
];

const LandingPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-muted/50 to-background">
    <section className="min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.1)_0%,transparent_50%)] bg-[radial-gradient(circle_at_80%_20%,rgba(255,119,198,0.1)_0%,transparent_50%)]" />
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between max-w-6xl mx-auto w-full gap-12">
        <div className="flex-1 max-w-xl text-center lg:text-left">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Scalextric Collection</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            La plataforma profesional para gestionar tu colección de coches de Slot y organizar competiciones de alto nivel
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
            <div key={i} className="flex flex-col items-center justify-center w-24 h-24 rounded-xl border bg-card shadow-md hover:shadow-lg transition-shadow">
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
            Todo lo que necesitas para tu pasión por el <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Slot</span>
          </h2>
          <p className="text-muted-foreground">Una plataforma completa diseñada para entusiastas y organizadores de competiciones</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow">
              <div className={`mb-4 ${f.color}`}><f.icon className="size-10" /></div>
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
        <p className="text-muted-foreground mb-6">Únete a la comunidad de entusiastas del Slot y lleva tu pasión al siguiente nivel</p>
        <Button asChild size="lg">
          <Link to="/login">Comenzar Ahora</Link>
        </Button>
      </div>
    </section>

    <footer className="border-t py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div>
            <h3 className="font-semibold mb-2">Slot Collection</h3>
            <p className="text-sm text-muted-foreground">Gestiona tu colección, organiza competiciones, analiza estadísticas</p>
          </div>
          <div className="flex gap-12">
            <div>
              <h4 className="font-medium mb-2">Funcionalidades</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {['Gestión de Vehículos', 'Competiciones', 'Estadísticas', 'Cronometraje'].map((item, i) => (
                  <li key={i}><Link to="/login" className="hover:text-foreground">{item}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Plataforma</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-foreground">Iniciar Sesión</Link></li>
                <li><Link to="/login?register=true" className="hover:text-foreground">Registrarse</Link></li>
                <li><Link to="/login" className="hover:text-foreground">Ayuda</Link></li>
                <li><Link to="/login" className="hover:text-foreground">Contacto</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-8">&copy; {new Date().getFullYear()} Slot Collection. Todos los derechos reservados.</p>
      </div>
    </footer>
  </div>
);

export default LandingPage;
