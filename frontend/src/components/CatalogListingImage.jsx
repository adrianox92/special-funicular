import React, { useState } from 'react';
import { cachedStorageImageUrl } from '../utils/cachedStorageImageUrl';
import { catalogThumbUrl } from '../utils/catalogImageVariants';

const DEFAULT_SIZES = '(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 320px';

/**
 * Miniatura para grids/listados. Si el sibling `-thumb` no existe aún, cae al original.
 */
export default function CatalogListingImage({
  imageUrl,
  alt = '',
  className,
  sizes = DEFAULT_SIZES,
  loading = 'lazy',
}) {
  const full = cachedStorageImageUrl(imageUrl);
  const thumb = cachedStorageImageUrl(catalogThumbUrl(imageUrl));
  const [useFull, setUseFull] = useState(!thumb || thumb === full);

  if (!full) return null;

  const src = useFull ? full : thumb;
  const srcSet = useFull ? undefined : `${thumb} 400w, ${full} 1400w`;

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => {
        if (!useFull && full) setUseFull(true);
      }}
    />
  );
}
