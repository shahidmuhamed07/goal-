/**
 * Dev-only preview of the brand loader.
 *
 * Vite only builds index.html, so this page never ships. It exists so the
 * loading animation can be watched full-screen at /loader-demo.html while it is
 * being tuned, instead of only flashing past during app boot.
 */
import { createRoot } from 'react-dom/client';
import './index.css';
import { GoalPathLoader } from './components/UIElements';

createRoot(document.getElementById('root')!).render(<GoalPathLoader message="Loading your goals..." />);
