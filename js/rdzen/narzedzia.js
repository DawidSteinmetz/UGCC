// Drobne narzędzia wspólne dla systemu i aplikacji.

// Natywne append/prepend zamieniają null na tekst „null”. W całym systemie (datapad i panel MG)
// budujemy widoki z warunkowymi kawałkami (`warunek ? element : null`), więc puste wartości
// po prostu pomijamy.
for (const metoda of ['append', 'prepend']) {
  const oryginal = Element.prototype[metoda];
  Element.prototype[metoda] = function (...wezly) {
    return oryginal.apply(this, wezly.filter((x) => x !== null && x !== undefined && x !== false));
  };
}

// Tworzenie elementów: h('div.klasa#id', {atrybuty}, ...dzieci)
export function h(opis, atrybuty = {}, ...dzieci) {
  const [, tag = 'div', reszta = ''] = opis.match(/^([a-z0-9]*)(.*)$/i);
  const el = document.createElement(tag || 'div');
  for (const czesc of reszta.match(/[.#][^.#]+/g) || []) {
    if (czesc[0] === '.') el.classList.add(czesc.slice(1));
    else el.id = czesc.slice(1);
  }
  // Drugi argument to atrybuty tylko wtedy, gdy jest zwykłym obiektem; liczba, tekst czy element to treść.
  if (atrybuty === null || typeof atrybuty !== 'object' || atrybuty instanceof Node || Array.isArray(atrybuty)) {
    dzieci.unshift(atrybuty);
    atrybuty = {};
  }
  for (const [k, v] of Object.entries(atrybuty || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  dodaj(el, dzieci);
  return el;
}

function dodaj(el, dzieci) {
  for (const d of dzieci) {
    if (d === null || d === undefined || d === false) continue;
    if (Array.isArray(d)) dodaj(el, d);
    else el.append(d instanceof Node ? d : document.createTextNode(String(d)));
  }
}

export function wyczysc(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

// Ikony rysowane kreską (bez napisów, więc działają w obu alfabetach).
export function ikona(sciezki) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = sciezki;
  return svg;
}

// ----- czas galaktyczny -----
// Rok GST liczony od realnego roku (2026 → GST16), daty dni zostają prawdziwe,
// bo sesje gry odbywają się w prawdziwe dni.
export const PRZESUNIECIE_GST = 2010;

export const DNI_TYG = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

export function rokGST(d = new Date()) {
  return d.getFullYear() - PRZESUNIECIE_GST;
}

export function godzina(d = new Date()) {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export function dataGST(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} · GST${rokGST(d)}`;
}

export function miesiacGST(d) {
  return `${String(d.getMonth() + 1).padStart(2, '0')} · GST${rokGST(d)}`;
}

export function iso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function zIso(s) {
  const [r, m, d] = s.split('-').map(Number);
  return new Date(r, m - 1, d);
}

export function czekaj(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Pamięć ustawień urządzenia (może być niedostępna, np. w trybie prywatnym).
export const pamiec = {
  czytaj(k, dom) {
    try {
      const v = localStorage.getItem('datapad.' + k);
      return v === null ? dom : JSON.parse(v);
    } catch {
      return dom;
    }
  },
  zapisz(k, v) {
    try {
      localStorage.setItem('datapad.' + k, JSON.stringify(v));
    } catch { /* trudno, ustawienie zniknie po odświeżeniu */ }
  },
};

// Losowy „szum szyfru" do efektów dekodowania.
const ZNAKI_SZYFRU = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function szum(dl) {
  let s = '';
  for (let i = 0; i < dl; i++) s += Math.random() < 0.12 ? ' ' : ZNAKI_SZYFRU[(Math.random() * ZNAKI_SZYFRU.length) | 0];
  return s;
}
