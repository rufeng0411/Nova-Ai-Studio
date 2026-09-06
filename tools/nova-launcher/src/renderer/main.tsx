import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/terminal.css';

window.addEventListener('unhandledrejection', (event) => {
  console.error('[nova-launcher] renderer rejection:', event.reason);
  event.preventDefault();
});

function Bootstrap() {
  if (!window.launcher) {
    return (
      <div className="boot-screen">
        <span className="boot-mark">◈</span>
        <p className="boot-error">桥接失败，请重新运行 npm run launcher</p>
      </div>
    );
  }
  return <App />;
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('[nova-launcher] root element missing');
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <Bootstrap />
    </StrictMode>,
  );
}
