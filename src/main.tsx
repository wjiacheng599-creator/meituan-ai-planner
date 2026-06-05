import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 修复 localStorage 损坏数据：确保数组字段不被破坏
try {
  const stored = localStorage.getItem('meituan-planner-storage');
  if (stored) {
    const parsed = JSON.parse(stored);
    const state = parsed?.state;
    if (state) {
      let needsFix = false;
      for (const key of ['savedPlans', 'profiles', 'plannerTaskStates', 'taskSessions', 'orders']) {
        if (state[key] && !Array.isArray(state[key])) {
          state[key] = [];
          needsFix = true;
        }
      }
      if (needsFix) {
        parsed.state = state;
        localStorage.setItem('meituan-planner-storage', JSON.stringify(parsed));
        console.log('[main] Fixed corrupted localStorage arrays');
      }
    }
  }
} catch (e) {
  /* ignore */
}

createRoot(document.getElementById('root')!).render(<App />);
