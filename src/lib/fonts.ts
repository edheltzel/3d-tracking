// Self-hosted fonts (SIL OFL, latin subset). Registered from JS because Forge serves assets
// by import URL and doesn't rewrite url() in CSS; its CSP also blocks Google Fonts.
import monoUrl from "../../assets/fonts/jetbrains-mono-var-latin.woff2";
import archivoUrl from "../../assets/fonts/archivo-var-latin.woff2";
import silkscreenUrl from "../../assets/fonts/silkscreen-latin.woff2";

const faces = [
  new FontFace("JetBrains Mono", `url(${monoUrl}) format("woff2")`, { weight: "400 500", display: "swap" }),
  new FontFace("Archivo", `url(${archivoUrl}) format("woff2")`, { weight: "300 600", stretch: "100% 125%", display: "swap" }),
  new FontFace("Silkscreen", `url(${silkscreenUrl}) format("woff2")`, { weight: "400", display: "swap" }),
];
for (const f of faces) {
  document.fonts.add(f);
  f.load().catch(() => {});
}
