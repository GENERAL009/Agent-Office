import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { useOffice } from './store.js';

window.__office = useOffice; // brauzer konsolida tekshirish uchun
createRoot(document.getElementById('root')).render(<App />);
