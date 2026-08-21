interface Props {
  className?: string
}

/**
 * Full icon + wordmark lockup, inlined (rather than referenced via
 * `<use href="external.svg#id">`) so the ink color can respond to the
 * page's theme: the arms of the icon and the wordmark use `currentColor`,
 * so wrapping this in an element with a themed `color` (see the
 * `.site-logo` classes in globals.css) is what makes it legible on both
 * light and dark backgrounds. A cross-document `<use>` reference can't
 * pick up CSS from the referencing page, which is why that approach
 * always rendered the SVG's original navy fill regardless of theme.
 */
export default function XtrackLogo({ className = '' }: Props) {
  return (
    <svg
      viewBox="18 18 467 122"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Xtrack"
      preserveAspectRatio="xMidYMid meet"
    >
      <title>Xtrack</title>
      <g fill="currentColor">
        <path d="M 27.58 38.632 L 58.27 38.632 L 88.96 74.668 L 72.22 94.072 Z" />
        <path d="M 102.91 99.616 L 128.02 130.108 L 158.71 130.108 L 119.65 85.756 Z" />
      </g>
      <path d="M 22 135.652 L 52.69 135.652 L 141.97 38.632 L 125.23 24.772 Z" fill="#E2835F" />
      <path d="M 125.23 44.176 L 164.29 22 L 144.76 60.808 Z" fill="#E2835F" />
      <path d="M 44.32 132.88 L 53.248 132.88 L 53.248 117.3568 L 44.32 117.3568 Z" fill="#ffffff" />
      <path d="M 59.944 132.88 L 68.872 132.88 L 68.872 107.932 L 59.944 107.932 Z" fill="#ffffff" />
      <path d="M 75.568 132.88 L 84.496 132.88 L 84.496 96.844 L 75.568 96.844 Z" fill="#ffffff" />
      <g fill="currentColor">
        <g transform="translate(189.0603 125.4497) scale(1.18 -1.18)">
          <path
            transform="scale(0.015625)"
            d="M 2047 3494 L 1372 3494 L 1372 4325 L 559 4325 L 559 3494 L 63 3494 L 63 2856 L 559 2856 L 559 916 C 559 297 931 -47 1600 -47 C 1772 -47 1966 -25 2144 28 L 2016 656 C 1938 638 1794 616 1719 616 C 1472 616 1372 731 1372 984 L 1372 2856 L 2047 2856 L 2047 3494 Z"
          />
          <path
            transform="translate(35.302734 0) scale(0.015625)"
            d="M 431 0 L 1244 0 L 1244 2056 C 1244 2500 1578 2813 2031 2813 C 2175 2813 2347 2791 2416 2772 L 2416 3519 C 2338 3531 2209 3541 2119 3541 C 1719 3541 1381 3313 1256 2909 L 1219 2909 L 1219 3494 L 431 3494 L 431 0 Z"
          />
          <path
            transform="translate(75 0) scale(0.015625)"
            d="M 1406 -72 C 1950 -72 2281 181 2434 481 L 2466 481 L 2466 0 L 3244 0 L 3244 2334 C 3244 3266 2475 3538 1819 3538 C 1119 3538 544 3241 338 2625 L 1091 2472 C 1175 2703 1416 2913 1822 2913 C 2219 2913 2431 2713 2431 2372 L 2431 2356 C 2431 2116 2175 2106 1569 2041 C 894 1969 238 1769 238 981 C 238 294 741 -72 1406 -72 Z M 1616 531 C 1272 531 1025 688 1025 991 C 1025 1309 1300 1444 1666 1494 C 1875 1522 2328 1578 2438 1666 L 2438 1253 C 2438 866 2116 531 1616 531 Z"
          />
          <path
            transform="translate(132.421875 0) scale(0.015625)"
            d="M 1947 -72 C 2731 -72 3313 353 3463 1050 L 2703 1209 C 2619 831 2353 588 1953 588 C 1388 588 1106 1084 1106 1731 C 1106 2384 1388 2878 1953 2878 C 2347 2878 2606 2644 2694 2281 L 3453 2441 C 3303 3122 2725 3538 1947 3538 C 928 3538 278 2816 278 1728 C 278 653 928 -72 1947 -72 Z"
          />
          <path
            transform="translate(190.673828 0) scale(0.015625)"
            d="M 431 0 L 1244 0 L 1244 1175 L 1544 1497 L 2622 0 L 3597 0 L 2163 1984 L 3516 3494 L 2563 3494 L 1303 2084 L 1244 2084 L 1244 4656 L 431 4656 L 431 0 Z"
          />
        </g>
      </g>
    </svg>
  )
}
