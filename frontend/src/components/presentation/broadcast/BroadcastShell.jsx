import React from 'react';
import { cn } from '../../../lib/utils';
import '../../../styles/BroadcastPresentation.css';

const BroadcastShell = ({
  children,
  variant = 'default',
  className,
  ...props
}) => (
  <div
    className={cn(
      'broadcast-shell',
      variant === 'overlay' && 'broadcast-shell--overlay',
      variant === 'tv' && 'broadcast-shell--tv',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export default BroadcastShell;
