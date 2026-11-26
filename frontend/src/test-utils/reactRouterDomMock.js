import React from 'react';

function locationFromEntries(initialEntries) {
  const entry = Array.isArray(initialEntries) ? initialEntries[0] : null;
  if (!entry) {
    return { pathname: '/', search: '', hash: '', state: null, key: 'default' };
  }
  if (typeof entry === 'string') {
    const hashIndex = entry.indexOf('#');
    const hash = hashIndex >= 0 ? entry.slice(hashIndex) : '';
    const withoutHash = hashIndex >= 0 ? entry.slice(0, hashIndex) : entry;
    const searchIndex = withoutHash.indexOf('?');
    const search = searchIndex >= 0 ? withoutHash.slice(searchIndex) : '';
    const pathname = (searchIndex >= 0 ? withoutHash.slice(0, searchIndex) : withoutHash) || '/';
    return { pathname, search, hash, state: null, key: 'default' };
  }
  return {
    pathname: entry.pathname || '/',
    search: entry.search || '',
    hash: entry.hash || '',
    state: entry.state ?? null,
    key: 'default',
  };
}

let currentLocation = locationFromEntries();

export const MemoryRouter = ({ children, initialEntries }) => {
  currentLocation = locationFromEntries(initialEntries);
  return <>{children}</>;
};
export const BrowserRouter = ({ children }) => <>{children}</>;
export const Link = ({ to, children, ...props }) => (
  <a href={to} {...props}>
    {children}
  </a>
);
export const NavLink = Link;
export const Navigate = () => null;
export const Outlet = () => null;
export const useNavigate = () => jest.fn();
export const useLocation = () => currentLocation;
export const useParams = () => ({});
export const useSearchParams = () => [new URLSearchParams(), jest.fn()];
