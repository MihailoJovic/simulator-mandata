import React from 'react';
import ReactDOM from 'react-dom/client';
import { SimulatorPage } from './pages/SimulatorPage';
import { VisualPage } from './pages/VisualPage';
import './index.css';

const view = new URLSearchParams(window.location.search).get('view');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{view === 'visual' ? <VisualPage /> : <SimulatorPage />}</React.StrictMode>,
);
