import React from 'react';
import { Link } from 'react-router-dom';
import { FaCar, FaChartLine, FaTrophy, FaUsers, FaClock, FaCog } from 'react-icons/fa';
import '../styles/LandingPage.css';

const LandingPage = () => {
  const features = [
    {
      icon: <FaCar />,
      title: 'Gestión de Colección',
      description: 'Catálogo completo de tus coches Scalextric con fotos, especificaciones técnicas y detalles de modificación.',
      color: '#7876c6'
    },
    {
      icon: <FaChartLine />,
      title: 'Estadísticas Avanzadas',
      description: 'Análisis detallado de tu colección, inversiones, distribución por marcas y evolución temporal.',
      color: '#22c55e'
    },
    {
      icon: <FaTrophy />,
      title: 'Sistema de Competiciones',
      description: 'Organiza competiciones profesionales con múltiples rondas, cronometraje automático y rankings en vivo.',
      color: '#fbbf24'
    },
    {
      icon: <FaUsers />,
      title: 'Gestión de Participantes',
      description: 'Inscripciones públicas, gestión de equipos y seguimiento individual de cada piloto.',
      color: '#ff77c8'
    },
    {
      icon: <FaClock />,
      title: 'Cronometraje Preciso',
      description: 'Sistema de tiempos por vuelta, mejores vueltas y penalizaciones con precisión de milisegundos.',
      color: '#78dbfa'
    },
    {
      icon: <FaCog />,
      title: 'Configuración Avanzada',
      description: 'Personaliza reglas de competición, categorías y configuraciones específicas para cada evento.',
      color: '#6b7280'
    }
  ];

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-overlay"></div>
        </div>
        
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              <span className="title-gradient">Scalextric Collection</span>
            </h1>
            <p className="hero-subtitle">
              La plataforma profesional para gestionar tu colección de coches de Slot 
              y organizar competiciones de alto nivel
            </p>
            <div className="hero-actions">
              <Link to="/login" className="btn btn-primary btn-hero">
                Iniciar Sesión
              </Link>
              <Link to="/login?register=true" className="btn btn-outline-light btn-hero">
                Registrarse
              </Link>
            </div>
          </div>
          
          <div className="hero-visual">
            <div className="hero-cards">
              <div className="hero-card card-1">
                <FaCar className="card-icon" />
                <span>Colección</span>
              </div>
              <div className="hero-card card-2">
                <FaTrophy className="card-icon" />
                <span>Competiciones</span>
              </div>
              <div className="hero-card card-3">
                <FaChartLine className="card-icon" />
                <span>Estadísticas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Todo lo que necesitas para tu pasión por el <span className="title-gradient">Slot</span></h2>
            <p className="section-subtitle">
              Una plataforma completa diseñada para entusiastas y organizadores de competiciones
            </p>
          </div>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon" style={{ color: feature.color }}>
                  {feature.icon}
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">¿Listo para empezar?</h2>
            <p className="cta-subtitle">
              Únete a la comunidad de entusiastas del Slot y lleva tu pasión al siguiente nivel
            </p>
            <div className="cta-actions">
              <Link to="/login" className="btn btn-primary btn-large">
                Comenzar Ahora
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <h3>Slot Collection</h3>
              <p>Gestiona tu colección, organiza competiciones, analiza estadísticas</p>
            </div>
            <div className="footer-links">
              <div className="footer-section">
                <h4>Funcionalidades</h4>
                <ul>
                  <li><Link to="/login">Gestión de Vehículos</Link></li>
                  <li><Link to="/login">Competiciones</Link></li>
                  <li><Link to="/login">Estadísticas</Link></li>
                  <li><Link to="/login">Cronometraje</Link></li>
                </ul>
              </div>
              <div className="footer-section">
                <h4>Plataforma</h4>
                <ul>
                  <li><Link to="/login">Iniciar Sesión</Link></li>
                  <li><Link to="/login?register=true">Registrarse</Link></li>
                  <li><Link to="/login">Ayuda</Link></li>
                  <li><Link to="/login">Contacto</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 Slot Collection. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage; 