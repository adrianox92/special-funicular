import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from './ui/dialog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './ui/carousel';

export default function VehicleImageCarouselDialog({
  open,
  onOpenChange,
  slides = [],
  initialIndex = 0,
}) {
  const { t } = useTranslation('vehicles');
  const [api, setApi] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrentIndex(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api, onSelect]);

  useEffect(() => {
    if (!open || !api || slides.length === 0) return;

    const syncCarousel = () => {
      api.reInit();
      const index = Math.min(Math.max(0, initialIndex), slides.length - 1);
      api.scrollTo(index, true);
      setCurrentIndex(index);
    };

    // El diálogo anima su tamaño al abrir; Embla necesita recalcular el viewport en móvil.
    const frameId = requestAnimationFrame(syncCarousel);
    const timeoutId = window.setTimeout(syncCarousel, 150);

    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [open, api, initialIndex, slides.length]);

  if (slides.length === 0) return null;

  const showNav = slides.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-1/2 top-1/2 w-[calc(100vw-1rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 border-0 bg-black/95 p-3 sm:p-6 text-white shadow-2xl [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        <DialogTitle className="sr-only">{t('edit.images.carouselTitle')}</DialogTitle>
        <Carousel
          setApi={setApi}
          className="mx-auto w-full"
          opts={{ loop: false, align: 'center' }}
        >
          <div className="relative mx-auto w-full">
            <CarouselContent className="-ml-0">
              {slides.map((slide) => (
                <CarouselItem key={slide.name} className="min-w-0 shrink-0 grow-0 basis-full pl-0">
                  <div className="flex w-full flex-col items-center justify-center gap-3 px-1">
                    <img
                      src={slide.url}
                      alt={slide.label}
                      className="mx-auto block max-h-[75dvh] max-w-full object-contain"
                    />
                    <p className="w-full text-center text-sm text-white/90">{slide.label}</p>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {showNav && (
              <>
                <CarouselPrevious
                  className="left-1 top-1/2 z-10 h-11 w-11 -translate-y-1/2 border-white/30 bg-black/60 text-white hover:bg-black/80 hover:text-white disabled:opacity-30 sm:left-2"
                />
                <CarouselNext
                  className="right-1 top-1/2 z-10 h-11 w-11 -translate-y-1/2 border-white/30 bg-black/60 text-white hover:bg-black/80 hover:text-white disabled:opacity-30 sm:right-2"
                />
              </>
            )}
          </div>
        </Carousel>
        {showNav && (
          <p className="mt-1 text-center text-sm text-white/70 tabular-nums">
            {currentIndex + 1} / {slides.length}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
