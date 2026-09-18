import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { cn } from './ui/utils';

/**
 * Paginación con ventana de números, primera/última página y anterior/siguiente.
 * Misma lógica responsive que VehicleList (max 3 botones en viewport estrecho).
 * Si se pasa `getPageHref`, los controles son <a href> reales (rastreables).
 */
function PageRangePagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  className,
  getPageHref,
}) {
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

  const renderControl = (targetPage, label, extra = {}) => {
    const href = getPageHref && !disabled ? getPageHref(targetPage) : null;
    if (href) {
      return (
        <Button variant={extra.variant || 'outline'} size="sm" asChild>
          <Link to={href} aria-current={extra['aria-current']}>
            {label}
          </Link>
        </Button>
      );
    }
    return (
      <Button
        variant={extra.variant || 'outline'}
        size="sm"
        disabled={disabled || extra.disabled}
        onClick={() => onPageChange(targetPage)}
        aria-current={extra['aria-current']}
      >
        {label}
      </Button>
    );
  };

  return (
    <nav aria-label="Paginación" className={cn('flex flex-wrap items-center justify-center gap-2', className)}>
      {safePage <= 1
        ? (
          <Button variant="outline" size="sm" disabled>
            Anterior
          </Button>
        )
        : renderControl(safePage - 1, 'Anterior')}
      {startPage > 1 && renderControl(1, '1')}
      {nums.map((n) =>
        renderControl(n, String(n), {
          variant: n === safePage ? 'default' : 'outline',
          'aria-current': n === safePage ? 'page' : undefined,
        }),
      )}
      {endPage < totalPages && renderControl(totalPages, String(totalPages))}
      {safePage >= totalPages
        ? (
          <Button variant="outline" size="sm" disabled>
            Siguiente
          </Button>
        )
        : renderControl(safePage + 1, 'Siguiente')}
    </nav>
  );
}

export default PageRangePagination;
