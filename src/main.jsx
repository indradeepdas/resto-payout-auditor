import React from 'react';
import ReactDOM from 'react-dom/client';
import { PostHogProvider } from '@posthog/react';
import App from './App.jsx';
import { initAnalytics } from './analytics.js';
import './styles.css';

const posthogClient = initAnalytics();
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  posthogClient ? <PostHogProvider client={posthogClient}>{app}</PostHogProvider> : app,
);
