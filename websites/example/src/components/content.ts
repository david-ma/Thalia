export function renderContent(): string {
  return `
    <main class="content">
      <div class="container">
        <section class="features">
          <h2>Features</h2>
          <div class="feature-grid">
            <div class="feature">
              <h3>TypeScript</h3>
              <p>Modern type-safe JavaScript development</p>
            </div>
            <div class="feature">
              <h3>SCSS</h3>
              <p>Powerful CSS preprocessing</p>
            </div>
            <div class="feature">
              <h3>Handlebars</h3>
              <p>Flexible templating system</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  `;
} 