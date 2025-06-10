import { renderHeader } from './components/header';
import { renderContent } from './components/content';
import { renderFooter } from './components/footer';

export function renderApp(container: HTMLElement): void {
  container.innerHTML = `
    <div class="app">
      ${renderHeader()}
      ${renderContent()}
      ${renderFooter()}
    </div>
  `;
} 