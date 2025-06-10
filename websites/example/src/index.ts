import './styles/main.scss';
import { renderApp } from './app';

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (app) {
    renderApp(app);
  }
}); 