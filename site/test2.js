const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
window.fetch = async () => ({
  ok: true,
  json: async () => ({
    transmissoes: [
      { banda_metros: '120m', estacao: 'Test', freq_khz: 2300, idioma: 'PT', pais_origem: 'BR', area_alvo: 'BR' }
    ],
    generated_at: new Date().toISOString(),
    temporada: 'A23'
  })
});
window.IntersectionObserver = class { observe() {} disconnect() {} };
window.requestAnimationFrame = (cb) => setTimeout(cb, 16);

try {
  window.eval(js);
  console.log("No top-level errors");
  
  setTimeout(() => {
    console.log("Elements count:", window.document.querySelectorAll('.tx-card').length);
    if (window.document.querySelectorAll('.tx-card').length > 0) {
      console.log("SUCCESS");
    } else {
      console.log("FAIL: cards not rendered. Error might have happened.");
    }
  }, 200);
} catch (e) {
  console.error(e);
}
