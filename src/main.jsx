import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ConsentProvider } from './context/ConsentContext.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ConsentProvider>
          <App />
        </ConsentProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
