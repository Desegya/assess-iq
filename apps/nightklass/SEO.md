# Nightklass SEO

The production origin is `https://nightklass.com`, defined in `src/lib/seo.ts`.
If the launch domain changes, update this value and the domain printed in
`src/app/opengraph-image.tsx` before deployment.

The homepage has a canonical URL, search description, Open Graph and Twitter
previews, and Organization/WebSite JSON-LD. The landing content is still
server-rendered initially; its existing authenticated redirect remains intact.
Only the homepage appears in `/sitemap.xml`.

All other pages inherit `noindex` metadata. Middleware also supplies
`X-Robots-Tag: noindex, follow` on application and account routes. Robots.txt
allows these pages to be crawled so search engines can read their noindex
instructions. Authentication remains responsible for protecting private data.

After deployment:

- Ensure HTTP and alternate hosts redirect permanently to the canonical HTTPS host.
- Verify domain ownership in Google Search Console and submit `/sitemap.xml`.
- Inspect the homepage's rendered HTML, canonical URL and indexing status in Search Console.
- Check `/robots.txt`, `/sitemap.xml` and `/opengraph-image` on the live domain.
- Keep staging/preview deployments out of search using deployment-level noindex headers.
- Monitor Search Console indexing and Core Web Vitals with real traffic.

Do not add invented reviews, ratings, or unsupported claims to structured data.
Future public guides or feature pages should have useful original content,
individual metadata and canonical URLs, internal links, and sitemap entries.
