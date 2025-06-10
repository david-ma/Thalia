export function renderFooter(): string {
  return `
    <footer class="footer">
      <div class="container">
        <p>&copy; ${new Date().getFullYear()} Thalia Framework</p>
      </div>
    </footer>
  `;
} 