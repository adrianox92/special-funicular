import React from 'react';
import { useParams } from 'react-router-dom';
import { isCatalogItemUuid } from '../utils/catalogSlug';
import PublicCatalogList from './PublicCatalogList';
import PublicCatalogDetail from './PublicCatalogDetail';

/**
 * /catalogo y /catalogo/* — si el primer segmento es UUID de ítem, ficha; si no, listado SEO.
 * Evita que /catalogo/avant-slot (marca) se interprete como ficha con id inválido.
 */
export default function PublicCatalogEntry() {
  const { '*': splat = '' } = useParams();
  const segments = splat.split('/').filter(Boolean);

  if (segments.length > 0 && isCatalogItemUuid(segments[0])) {
    return (
      <PublicCatalogDetail catalogItemId={segments[0]} catalogSlug={segments[1]} />
    );
  }
  return <PublicCatalogList />;
}
