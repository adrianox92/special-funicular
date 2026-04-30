import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { cn } from './ui/utils';

/**
 * Paginación con ventana de números, primera/última página y anterior/siguiente.
 * Misma lógica responsive que VehicleList (max 3 botones en viewport estrecho).
 */
function PageRangePagination({ page, totalPages, onPageChange, disabled = false, className }) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (!totalPages || totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const maxVisible = narrow ? 3 : 5;
  let startPage = Math.max(1, safePage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  const nums = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  return (
    <nav aria-label="Paginación" className={cn('flex flex-wrap items-center justify-center gap-2', className)}>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
      >
        Anterior
      </Button>
      {startPage > 1 && (
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => onPageChange(1)}>
          1
        </Button>
      )}
      {nums.map((n) => (
        <Button
          key={n}
          variant={n === safePage ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          onClick={() => onPageChange(n)}
          aria-current={n === safePage ? 'page' : undefined}
        >
          {n}
        </Button>
      ))}
      {endPage < totalPages && (
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => onPageChange(totalPages)}>
          {totalPages}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || safePage >= totalPages}
        onClick={() => onPageChange(safePage + 1)}
      >
        Siguiente
      </Button>
    </nav>
  );
}

export default PageRangePagination;
