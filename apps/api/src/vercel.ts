// Handler de la función de Vercel. El build lo empaqueta (esbuild) como dist/app.js, el archivo que el builder de
// Vercel toma como handler. Reexporta app.ts para que `dist/app.js` siga ofreciendo `createApp` al servidor local.
import { createAppFromEnv } from './runtime.js'

export * from './app.js'

const { app, warnings } = createAppFromEnv(process.env)
for (const warning of warnings) console.warn(warning)

export default { fetch: (request: Request) => app.fetch(request) }
