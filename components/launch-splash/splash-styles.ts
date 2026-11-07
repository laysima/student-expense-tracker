// Inlined into <head> by app/layout.tsx rather than living in globals.css.
// The splash is the very first thing painted, so its rules must not depend on
// a stylesheet arriving (or a dev server serving a stale one). The overlay is
// also display:none inline, so if these rules are ever missing it stays hidden
// instead of rendering a full-width logo above the page.
// The first frame (everything at rest) must match the iPhone startup images in
// public/splash/, which are screenshots of this overlay at rest. Re-shoot them
// after changing the layout.
export const SPLASH_CSS = `
.xt-splash {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  overflow: hidden;
  background: radial-gradient(120% 80% at 50% 40%, #2b392d 0%, #1b211c 58%, #121512 100%);
  color: #f1ece2;
}

html[data-splash='on'] .xt-splash,
html[data-splash='leaving'] .xt-splash {
  display: block !important;
}

html[data-splash='on'] body {
  overflow: hidden;
}

html[data-splash='leaving'] .xt-splash {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.45s ease 0.1s;
}

.xt-splash__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding-bottom: 6vh;
}

.xt-splash__mark {
  width: min(42vw, 190px);
  height: auto;
  overflow: visible;
}

/* The three bars rise and fall like a live chart. They start at full height,
   so the first frame is the plain logo and matches the startup image. */
.xt-splash__bar {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: xt-chart 1.1s ease-in-out infinite;
}

.xt-splash__bar:nth-child(2) { animation-delay: 0.18s; }
.xt-splash__bar:nth-child(3) { animation-delay: 0.36s; }

.xt-splash__word {
  height: 26px;
  width: auto;
}

.xt-splash__caption {
  margin-top: 8px;
  font-family: var(--font-poppins), ui-sans-serif, system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.55;
}

@keyframes xt-chart {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.35); }
}

@media (prefers-reduced-motion: reduce) {
  .xt-splash__bar {
    animation: none;
  }
}
`
