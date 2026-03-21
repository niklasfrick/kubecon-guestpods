import { render } from 'preact';
import { App } from './app';
import './style.css';

// On /viz route, remove #app padding so canvas is edge-to-edge
if (window.location.pathname === '/viz') {
  const appEl = document.getElementById('app');
  if (appEl) {
    appEl.style.padding = '0';
    appEl.style.display = 'block';
  }
}

render(<App />, document.getElementById('app')!);
