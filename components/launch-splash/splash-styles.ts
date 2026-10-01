// Inlined into <head> by app/layout.tsx rather than living in globals.css.
// The splash is the very first thing painted, so its rules must not depend on
// a stylesheet arriving (or a dev server serving a stale one). The overlay is
// also display:none inline, so if these rules are ever missing it stays hidden
// instead of rendering a full-width logo above the page.
// --xt-mark and the 42% offset must match splash-scene.ts.
export const SPLASH_CSS = `
.xt-splash {
  --xt-mark: min(46vw, 210px);
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

.xt-splash__stage {
  position: absolute;
  inset: 0;
}

.xt-splash__mark {
  position: absolute;
  top: 42%;
  left: 50%;
  width: var(--xt-mark);
  transform: translate(-50%, -50%);
  animation: xt-breathe 1.6s ease-in-out infinite;
  transition: opacity 0.2s ease;
}

/* The 3D mark takes over in exactly the same spot. */
.xt-splash[data-live] .xt-splash__mark {
  opacity: 0;
  animation: none;
}

.xt-splash__brand {
  position: absolute;
  top: calc(42% + var(--xt-mark) * 0.4 + 28px);
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  transform: translateX(-50%);
  animation: xt-rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.35s both;
}

.xt-splash__word {
  height: 30px;
  width: auto;
}

.xt-splash__bar {
  position: relative;
  width: 64px;
  height: 2px;
  overflow: hidden;
  border-radius: 2px;
  background: rgb(241 236 226 / 14%);
}

.xt-splash__bar::after {
  content: '';
  position: absolute;
  inset: 0;
  width: 40%;
  border-radius: inherit;
  background: #e2835f;
  animation: xt-scan 1.1s ease-in-out infinite;
}

@keyframes xt-breathe {
  0%, 100% { opacity: 0.8; transform: translate(-50%, -50%) scale(0.97); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes xt-rise {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

@keyframes xt-scan {
  from { transform: translateX(-100%); }
  to { transform: translateX(250%); }
}

@media (prefers-reduced-motion: reduce) {
  .xt-splash__mark,
  .xt-splash__brand,
  .xt-splash__bar::after {
    animation: none;
  }
}
`
