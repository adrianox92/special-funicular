import React from 'react';

/**
 * Aviso sobre marcas, logotipos e imágenes de terceros en el catálogo público.
 */
export default function CatalogThirdPartyNotice() {
  return (
    <aside
      className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground leading-relaxed"
      aria-label="Aviso sobre marcas e imágenes de terceros"
    >
      <p>
        Los nombres comerciales, logotipos e imágenes mostrados son propiedad de sus respectivos
        titulares.{' '}
        <span className="text-foreground/90 font-medium">Slot Database</span> no está afiliado
        ni patrocinado por dichos titulares. El contenido se ofrece solo con fines informativos.
      </p>
    </aside>
  );
}
