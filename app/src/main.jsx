import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { useOffice, positions } from './store.js';

window.__office = useOffice; // brauzer konsolida tekshirish uchun
window.__positions = positions;
createRoot(document.getElementById('root')).render(<App />);
