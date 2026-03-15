import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/50 mt-auto">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <p className="text-center text-sm text-muted-foreground">
          © {currentYear} Adrian Palomera Sanz. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
