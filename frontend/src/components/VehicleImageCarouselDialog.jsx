import React, { useCallback, useEffect, useState } from 'react';
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
    const index = Math.min(Math.max(0, initialIndex), slides.length - 1);
    api.scrollTo(index, true);
    setCurrentIndex(index);
  }, [open, api, initialIndex, slides.length]);

  if (slides.length === 0) return null;

  const showNav = slides.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-4xl border-0 bg-black/95 p-4 sm:p-6 text-white shadow-2xl">
        <DialogTitle className="sr-only">Fotografías del vehículo</DialogTitle>
        <Carousel setApi={setApi} className="w-full" opts={{ loop: false }}>
          <div className="relative px-10 sm:px-12">
            <CarouselContent className="-ml-0">
              {slides.map((slide) => (
                <CarouselItem key={slide.name} className="pl-0 basis-full">
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={slide.url}
                      alt={slide.label}
                      className="max-h-[75dvh] w-full object-contain"
                    />
                    <p className="text-sm text-white/90 text-center">{slide.label}</p>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {showNav && (
              <>
                <CarouselPrevious
                  className="left-0 top-[calc(50%-1.25rem)] h-11 w-11 border-white/30 bg-black/60 text-white hover:bg-black/80 hover:text-white disabled:opacity-30"
                />
                <CarouselNext
                  className="right-0 top-[calc(50%-1.25rem)] h-11 w-11 border-white/30 bg-black/60 text-white hover:bg-black/80 hover:text-white disabled:opacity-30"
                />
              </>
            )}
          </div>
        </Carousel>
        {showNav && (
          <p className="text-center text-sm text-white/70 tabular-nums mt-1">
            {currentIndex + 1} / {slides.length}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
