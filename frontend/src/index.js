import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/competitions.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { CookieConsentProvider } from './context/CookieConsentContext';
import { ThemeProvider } from './context/ThemeContext';
import { register } from './serviceWorkerRegistration';
register();


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <CookieConsentProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </CookieConsentProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
