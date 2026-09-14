/**
 * `process.env.X!` only silences TypeScript. At runtime a missing value is still
 * `undefined`, Supabase then fails with something opaque, and because the proxy
 * middleware builds a client on *every* request that surfaces as a bare
 * "Internal Server Error" across the entire site — with nothing naming the cause.
 *
 * The value is passed in rather than looked up by name on purpose: Next only
 * inlines `NEXT_PUBLIC_*` variables into the browser bundle where it can see a
 * literal `process.env.NEXT_PUBLIC_FOO` reference. A dynamic `process.env[name]`
 * lookup is never inlined, so doing that here would break the browser client.
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. ` +
        'On Vercel: Project → Settings → Environment Variables, then redeploy — ' +
        'NEXT_PUBLIC_* values are inlined at build time, so a redeploy is required ' +
        'for them to take effect. Locally it belongs in .env.local.',
    )
  }
  return value
}
