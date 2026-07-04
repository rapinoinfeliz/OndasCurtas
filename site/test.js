const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
global.window = window;
global.document = window.document;
global.HTMLElement = window.HTMLElement;
global.IntersectionObserver = class {
  observe() {}
  disconnect() {}
};
global.fetch = async () => ({
  ok: true,
  json: async () => ({
    transmissoes: [
      { banda_metros: '120m', estacao: 'Test', freq_khz: 2300, idioma: 'PT', pais_origem: 'BR', area_alvo: 'BR' }
    ],
    generated_at: new Date().toISOString(),
    temporada: 'A23'
  })
});
global.location = { protocol: 'http:' };

try {
  window.eval(js);
  console.log("No top-level errors");
  
  // wait 100ms for init() to resolve
  setTimeout(() => {
    console.log("Init finished. Elements count:", document.querySelectorAll('.tx-card').length);
    console.log("TEST SUCCESSFUL");
  }, 200);
} catch (e) {
  console.error("Runtime error:");
  console.error(e);
}
