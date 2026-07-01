import { useEffect, useState } from 'react';

const QUERIES = {
  mobile: '(max-width: 639px)',
  tablet: '(min-width: 640px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px) and (max-width: 1919px)',
  tv: '(min-width: 1920px)',
};

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useBroadcastLayout() {
  const isMobile = useMediaQuery(QUERIES.mobile);
  const isTablet = useMediaQuery(QUERIES.tablet);
  const isDesktop = useMediaQuery(QUERIES.desktop);
  const isTv = useMediaQuery(QUERIES.tv);

  const layout =
    isTv ? 'tv' : isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile';

  return {
    layout,
    isMobile,
    isTablet,
    isDesktop,
    isTv,
    useMobileTabs: isMobile,
    // Scroll de página: el viewport fijo recortaba sidebar y paneles en desktop/TV
    fixedViewport: false,
  };
}

export default useBroadcastLayout;
