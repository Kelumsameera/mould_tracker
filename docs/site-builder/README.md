# Documentation publication boundary

`npm run build` publishes only the reviewed user guides listed in `public-pages.mjs`, reading their content from `docs/public/`. It never discovers additional pages. `npm test` rebuilds the site and checks the publication allowlist, internal links and private-content patterns.

The rest of `docs/` is internal source material for developers and owners. Keep technical references, repository details, operations, configuration, evidence and internal exports outside web-served directories. Local document exports remain internal and must not be uploaded to the downloads directory.

Deploy the generated `docs/site/` to the dedicated `deploy/lan-certificates/public-docs/` directory. Nginx serves this directory under `/docs/`. When replacing a public release, remove or move the previous generated directory out of the web mount first; overlaying files does not remove old private pages. Never copy the entire `docs/` tree into a public directory.

Keep withdrawn documentation and deployment backups outside `deploy/lan-certificates/`. Public pages must contain user instructions only, without source-file footers, internal links, configuration values or credentials.
