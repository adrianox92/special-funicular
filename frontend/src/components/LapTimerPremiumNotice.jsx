import React from 'react';
import { Crown } from 'lucide-react';
import { cn } from '../lib/utils';

export default function LapTimerPremiumNotice({ className, compact = false }) {
  return (
    <div
      className={cn(
        'rounded-md border border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/20 flex gap-2',
        compact ? 'p-3 text-xs' : 'p-3 text-sm',
        className,
      )}
    >
      <Crown
        className={cn(
          'shrink-0 text-amber-600 dark:text-amber-400',
          compact ? 'size-3.5 mt-0.5' : 'size-4 mt-0.5',
        )}
      />
      <p className="text-muted-foreground">
        {compact ? (
          <>El entrenamiento guiado requiere suscripción Premium en Slot Lap Timer.</>
        ) : (
          <>
            El <span className="font-medium text-foreground">entrenamiento guiado</span> en Slot Lap
            Timer requiere suscripción Premium en la app.
          </>
        )}
      </p>
    </div>
  );
}
