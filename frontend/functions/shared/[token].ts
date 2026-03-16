interface Env {
  API_URL: string;
  FRONTEND_URL: string;
}

interface SharedFuture {
  name: string;
  title: string;
  archetype_id: string;
  portrait_url: string | null;
}

interface SharedSessionData {
  created_at: string;
  futures: SharedFuture[];
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const token = context.params.token as string;
  const apiUrl = context.env.API_URL || "http://localhost:8080";
  const frontendUrl = context.env.FRONTEND_URL || "https://mirror8.app";

  try {
    const res = await fetch(`${apiUrl}/api/shared/${token}`);
    if (!res.ok) {
      return notFoundPage(frontendUrl);
    }

    const data: SharedSessionData = await res.json();
    return new Response(renderSharePage(data, frontendUrl), {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  } catch {
    return notFoundPage(frontendUrl);
  }
};

function notFoundPage(frontendUrl: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Not Found — Mirror8</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <div class="container" style="text-align:center;padding-top:120px;">
    <h1 style="font-size:2rem;margin-bottom:1rem;color:#e4ddd5;">This link is no longer active</h1>
    <p style="color:#a39a90;margin-bottom:2rem;">The session owner may have disabled sharing.</p>
    <a href="${frontendUrl}" class="cta">Discover Your Future Selves</a>
  </div>
</body>
</html>`,
    { status: 404, headers: { "Content-Type": "text/html;charset=UTF-8" } },
  );
}

function renderSharePage(data: SharedSessionData, frontendUrl: string): string {
  const futures = data.futures;

  const portraitCards = futures
    .map(
      (f) => `
    <div class="card">
      <div class="portrait-wrap">
        ${
          f.portrait_url
            ? `<img src="${escapeHtml(f.portrait_url)}" alt="${escapeHtml(f.name)}" class="portrait" loading="lazy" />`
            : `<div class="portrait portrait-placeholder"></div>`
        }
      </div>
      <div class="card-name">${escapeHtml(f.name)}</div>
      <div class="card-title">${escapeHtml(f.title)}</div>
    </div>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>My 8 Future Selves — Mirror8</title>

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="My 8 Future Selves — Mirror8" />
  <meta property="og:description" content="What would your future self look like? Discover 8 AI-generated futures on Mirror8." />
  <meta property="og:image" content="${frontendUrl}/hero.jpg" />
  <meta property="og:url" content="${frontendUrl}" />
  <meta property="og:site_name" content="Mirror8" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="My 8 Future Selves — Mirror8" />
  <meta name="twitter:description" content="What would your future self look like? Discover 8 AI-generated futures on Mirror8." />
  <meta name="twitter:image" content="${frontendUrl}/hero.jpg" />

  <style>${baseStyles()}${pageStyles()}</style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">Mirror8</div>
    </header>

    <div class="hero">
      <h1>What would your future self look like?</h1>
      <p class="subtitle">8 AI-generated futures, each a possible version of you.</p>
    </div>

    <div class="grid">
      ${portraitCards}
    </div>

    <div class="cta-section">
      <a href="${frontendUrl}" class="cta">Discover Your Future Selves</a>
    </div>

    <footer>
      <div class="footer-line"></div>
      <p>Mirror8 &middot; AI conversations with your future self</p>
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function baseStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #111110;
      color: #e4ddd5;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
    }
    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 0 24px;
    }
    .cta {
      display: inline-block;
      padding: 14px 32px;
      background: #c9956b;
      color: #111110;
      text-decoration: none;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 1rem;
      transition: background 0.2s;
    }
    .cta:hover { background: #a67c52; }
  `;
}

function pageStyles(): string {
  return `
    header {
      padding: 24px 0;
    }
    .logo {
      font-size: 1.25rem;
      font-weight: 700;
      color: #c9956b;
    }
    .hero {
      text-align: center;
      padding: 40px 0 32px;
    }
    .hero h1 {
      font-size: 1.75rem;
      line-height: 1.3;
      margin-bottom: 12px;
      color: #f4f0eb;
    }
    .subtitle {
      color: #a39a90;
      font-size: 1rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 40px;
    }
    @media (max-width: 560px) {
      .grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .hero h1 { font-size: 1.5rem; }
    }
    .card {
      text-align: center;
    }
    .portrait-wrap {
      aspect-ratio: 1;
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 8px;
      background: #1c1a17;
      border: 1px solid #2a2722;
    }
    .portrait {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .portrait-placeholder {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #1c1a17 0%, #2a2722 100%);
    }
    .card-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: #e4ddd5;
      margin-bottom: 2px;
    }
    .card-title {
      font-size: 0.75rem;
      color: #7a7269;
    }
    .cta-section {
      text-align: center;
      padding: 8px 0 48px;
    }
    footer {
      text-align: center;
      padding-bottom: 40px;
      color: #564f48;
      font-size: 0.85rem;
    }
    .footer-line {
      width: 60px;
      height: 1px;
      background: #2a2722;
      margin: 0 auto 16px;
    }
  `;
}
