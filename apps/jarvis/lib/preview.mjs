function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

export function previewDocument(preview) {
  const name = escapeHtml(preview?.prospect || "This business");
  const brief = escapeHtml(preview?.brief || "");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} — draft preview</title>
  <style>
    body { margin: 0; font-family: Georgia, serif; background: #f4f7fb; color: #102033; }
    header { padding: 48px 24px; background: #0c1c33; color: #f7f1e4; }
    main { max-width: 720px; margin: 0 auto; padding: 32px 24px 64px; }
    .note { color: #5c6b7a; }
  </style>
</head>
<body>
  <header><p>Draft preview. Not launched.</p><h1>${name}</h1></header>
  <main>
    <p>This page uses only the message Jarvis saved. It is not a published website.</p>
    <h2>What they wrote</h2>
    <p>${brief}</p>
    <p class="note">Pages, price, and launch stay with Christian. Nothing was sent.</p>
  </main>
</body>
</html>`;
}
