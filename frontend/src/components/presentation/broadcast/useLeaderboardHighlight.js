import { useEffect, useRef, useState } from 'react';

/**
 * Devuelve clase CSS de highlight cuando la posición de un participante cambia.
 * @param {Array<{ id: string|number, position: number }>} participants
 */
export function useLeaderboardHighlight(participants) {
  const prevPositionsRef = useRef(new Map());
  const [highlights, setHighlights] = useState(() => new Map());

  useEffect(() => {
    const prev = prevPositionsRef.current;
    const next = new Map();

    participants.forEach((p) => {
      const id = String(p.id);
      const cur = Number(p.position);
      const prevPos = prev.get(id);
      if (prevPos != null && prevPos !== cur) {
        next.set(id, cur < prevPos ? 'moved-up' : 'moved-down');
      }
      prev.set(id, cur);
    });

    if (next.size > 0) {
      setHighlights(next);
      const timer = setTimeout(() => setHighlights(new Map()), 2500);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [participants]);

  const getHighlightClass = (participantId) => highlights.get(String(participantId)) || '';

  return { getHighlightClass };
}

export default useLeaderboardHighlight;
