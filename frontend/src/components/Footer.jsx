import React from 'react';
import { Container } from 'react-bootstrap';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark text-light py-3 mt-auto mt-3">
      <Container className="text-center">
        <p className="mb-0">
          © {currentYear} Adrian Palomera Sanz. Todos los derechos reservados.
        </p>
      </Container>
    </footer>
  );
};

export default Footer; 