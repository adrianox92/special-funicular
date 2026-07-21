import React from 'react';

export const MemoryRouter = ({ children }) => <>{children}</>;
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
export const useLocation = () => ({ pathname: '/', search: '', hash: '', state: null, key: 'default' });
export const useParams = () => ({});
export const useSearchParams = () => [new URLSearchParams(), jest.fn()];
