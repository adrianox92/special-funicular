import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Navbar as BootstrapNavbar, Nav, Container, Button, Dropdown, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { 
  FaTrophy, 
  FaCar, 
  FaClock, 
  FaUser, 
  FaSignOutAlt, 
  FaCog, 
  FaHome,
  FaBars,
  FaTimes
} from 'react-icons/fa';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const getUserInitials = () => {
    if (!user?.email) return 'U';
    return user.email.charAt(0).toUpperCase();
  };

  const navItems = [
    { path: '/', label: 'Inicio', icon: <FaHome /> },
    { path: '/vehicles', label: 'Vehículos', icon: <FaCar /> },
    { path: '/timings', label: 'Tiempos', icon: <FaClock /> },
    { path: '/competitions', label: 'Competiciones', icon: <FaTrophy /> }
  ];

  return (
    <BootstrapNavbar 
      bg="white" 
      variant="light" 
      expand="lg" 
      className={`custom-navbar shadow-sm ${isScrolled ? 'scrolled' : ''}`}
      fixed="top"
    >
      <Container fluid className="px-4">
        {/* Logo y Brand */}
        <BootstrapNavbar.Brand as={Link} to="/" className="brand-container">
          <div className="logo-container">
            <FaTrophy className="logo-icon" />
            <span className="logo-text">Slot</span>
            <Badge bg="primary" className="logo-badge">Pro</Badge>
          </div>
        </BootstrapNavbar.Brand>

        {/* Toggle Button */}
        <BootstrapNavbar.Toggle 
          aria-controls="basic-navbar-nav" 
          className="custom-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </BootstrapNavbar.Toggle>

        <BootstrapNavbar.Collapse id="basic-navbar-nav" className={isMenuOpen ? 'show' : ''}>
          {/* Navigation Links */}
          <Nav className="me-auto nav-links">
            {navItems.map((item) => (
              <Nav.Link 
                key={item.path}
                as={Link} 
                to={item.path} 
                className={`nav-link-custom ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {isActive(item.path) && <div className="active-indicator" />}
              </Nav.Link>
            ))}
          </Nav>

          {/* User Section */}
          <Nav className="user-section">
            {user && (
              <>
                {/* Notifications Badge */}
                <div className="notification-badge">
                  <Badge bg="danger" className="notification-dot">3</Badge>
                </div>

                {/* User Dropdown */}
                <Dropdown align="end" className="user-dropdown">
                  <Dropdown.Toggle variant="link" className="user-toggle" id="user-dropdown-toggle">
                    <div className="user-avatar">
                      <span className="user-initials">{getUserInitials()}</span>
                    </div>
                    <div className="user-info">
                      <span className="user-name">Usuario</span>
                      <span className="user-email">{user.email}</span>
                    </div>
                  </Dropdown.Toggle>

                  <Dropdown.Menu className="user-dropdown-menu" aria-labelledby="user-dropdown-toggle">
                    <Dropdown.Header className="dropdown-header">
                      <div className="dropdown-user-info">
                        <div className="dropdown-avatar">
                          <span className="dropdown-initials">{getUserInitials()}</span>
                        </div>
                        <div>
                          <div className="dropdown-name">Usuario</div>
                          <div className="dropdown-email">{user.email}</div>
                        </div>
                      </div>
                    </Dropdown.Header>
                    
                    <Dropdown.Divider />
                    
                    <Dropdown.Item as={Link} to="/profile" className="dropdown-item">
                      <FaUser className="dropdown-icon" />
                      <span>Mi Perfil</span>
                    </Dropdown.Item>
                    
                    <Dropdown.Item as={Link} to="/settings" className="dropdown-item">
                      <FaCog className="dropdown-icon" />
                      <span>Configuración</span>
                    </Dropdown.Item>
                    
                    <Dropdown.Divider />
                    
                    <Dropdown.Item onClick={handleLogout} className="dropdown-item logout-item">
                      <FaSignOutAlt className="dropdown-icon" />
                      <span>Cerrar Sesión</span>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </>
            )}
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
};

export default Navbar; 