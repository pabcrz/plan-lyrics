// Vercel Function (Node.js runtime) entry point. The business rules stay in the Hono app compiled to ../dist by
// `pnpm build`; this file only adapts it to the platform's web-standard `fetch` handler. Nothing here is
// Vercel-specific API: the local Node server (src/index.ts) builds the same app from the same environment.
import { createAppFromEnv } from '../dist/runtime.js'

const { app, warnings } = createAppFromEnv(process.env)
for (const warning of warnings) console.warn(warning)

export default { fetch: request => app.fetch(request) }
