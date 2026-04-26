import { loadJS9Runtime, getJS9 } from "@onekiloparsec/js9";

const status = document.getElementById("status");
const setStatus = (msg) => { status.textContent = msg; };

const REMOTE_SAMPLE =
  "https://hea-www.cfa.harvard.edu/~eric/coma.fits.gz";

async function main() {
  setStatus("loading runtime…");
  await loadJS9Runtime({
    baseUrl: "/",
    runtimePath: "runtime",
    onProgress: (e) => {
      if (e.phase === "loading") setStatus(`loading ${e.url}`);
    }
  });
  const JS9 = getJS9();
  if (!JS9) {
    setStatus("runtime loaded but JS9 global is missing");
    return;
  }
  setStatus("ready — drop a FITS file on the display, pick one, or click 'Load remote sample'");

  document.getElementById("load-remote").addEventListener("click", () => {
    setStatus(`fetching ${REMOTE_SAMPLE}…`);
    JS9.Load(REMOTE_SAMPLE, { onload: () => setStatus("loaded remote sample") });
  });

  document.getElementById("file-input").addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setStatus(`loading ${file.name}…`);
    JS9.Load(file, { onload: () => setStatus(`loaded ${file.name}`) });
  });
}

main().catch((err) => {
  console.error(err);
  setStatus(`error: ${err?.message ?? err}`);
});
