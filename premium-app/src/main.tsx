import { createRoot } from 'react-dom/client';
import App from './App';
import { DebugProps } from './scene/DebugProps';
import './index.css';
import { useOffice } from './store/useOffice';

// Dev-only handle for debugging and automated checks.
(window as unknown as { __office: typeof useOffice }).__office = useOffice; // for automated checks and capture

createRoot(document.getElementById('root')!).render(
  // No StrictMode: drei <Html> labels create their own React roots and StrictMode's
  // double mount makes them log harmless unmount warnings.
  new URLSearchParams(location.search).get('debug') === 'props' ? <DebugProps /> : <App />,
);
