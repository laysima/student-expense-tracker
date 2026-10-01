// Shared by the inline script in app/layout.tsx (a Server Component) and
// LaunchSplash. It lives outside the 'use client' file because importing a
// value from one into a Server Component yields a client reference, not the value.
export const SPLASH_SEEN_KEY = 'xt-splash-seen'
