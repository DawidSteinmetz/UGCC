// Scena w tle datapada: „stan faktyczny” postaci, ustawiany przez MG.
//
//   kosmos      — gwiazdy powoli dryfują
//   wejscie     — gwiazdy rozciągają się w smugi, błysk, potem tunel nadprzestrzeni
//   nadswietlna — tunel nadprzestrzeni
//   wyjscie     — smugi się kurczą, błysk, z ciemności wyłania się planeta
//   orbita      — planeta (typ i odległość od MG) na tle gwiazd
//
// Wszystko rysowane kodem na <canvas>, bez obrazków. Animacja zatrzymuje się, gdy scena
// jest niewidoczna (otwarta aplikacja, wygaszony ekran), żeby nie drenować baterii.

export const TYPY_PLANET = {
  pustynna: { nazwa: 'pustynna', kolory: ['#d9a35b', '#b97834', '#e8c58a'], atmosfera: '#f3c27a', chmury: 0.15 },
  lodowa: { nazwa: 'lodowa', kolory: ['#dbe9f4', '#9fc2dc', '#ffffff'], atmosfera: '#bfe3ff', chmury: 0.35 },
  oceaniczna: { nazwa: 'oceaniczna', kolory: ['#1f5fa8', '#163f7a', '#3b86c9'], atmosfera: '#6fb7ff', chmury: 0.55, lad: '#4f8a4a' },
  lesna: { nazwa: 'leśna', kolory: ['#2f6b34', '#1f4d26', '#5b8f3e'], atmosfera: '#9be0a6', chmury: 0.45, woda: '#235a8a' },
  wulkaniczna: { nazwa: 'wulkaniczna', kolory: ['#2a1a17', '#3d211a', '#1a1010'], atmosfera: '#ff6a3a', chmury: 0.1, lawa: '#ff5a1f' },
  gazowa: { nazwa: 'gazowy olbrzym', kolory: ['#c98a4b', '#e3b77d', '#8f5a35', '#f0d3a3'], atmosfera: '#ffd59a', pasy: true },
  miasto: { nazwa: 'miasto-planeta', kolory: ['#5d6470', '#454b55', '#7a818c'], atmosfera: '#ffd27a', chmury: 0.12, swiatla: true },
  bagienna: { nazwa: 'bagienna', kolory: ['#3b4f2f', '#2a3a24', '#55663a'], atmosfera: '#a9c98a', chmury: 0.6 },
  skalista: { nazwa: 'skalista', kolory: ['#8a8580', '#6b6661', '#a39e98'], atmosfera: '#d0d0d0', chmury: 0.05 },
};

export const ODLEGLOSCI = { blisko: 1.15, srednio: 0.5, daleko: 0.16 };

const CZAS_WEJSCIA = 3600;  // ms
const CZAS_WYJSCIA = 3200;

// Prosty generator liczb pseudolosowych z ziarnem (ta sama planeta wygląda zawsze tak samo).
function losowe(ziarno) {
  let s = ziarno >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function hash(t) {
  let x = 2166136261;
  for (const c of t) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
  return x >>> 0;
}

// Tekstura powierzchni planety: pas o szerokości 2× średnicy, przewijany przy obrocie.
function teksturaPlanety(typ, d, ziarno) {
  const t = TYPY_PLANET[typ] || TYPY_PLANET.skalista;
  const c = document.createElement('canvas');
  c.width = d * 2;
  c.height = d;
  const g = c.getContext('2d');
  const los = losowe(ziarno);
  g.fillStyle = t.kolory[0];
  g.fillRect(0, 0, c.width, c.height);

  // Rysuje plamę także „za krawędzią”, żeby pas łączył się bez szwu.
  const plama = (x, y, rx, ry, kolor, alfa) => {
    g.globalAlpha = alfa;
    g.fillStyle = kolor;
    for (const dx of [0, -c.width / 2, c.width / 2]) {
      g.beginPath();
      g.ellipse(((x + dx) % c.width + c.width) % c.width, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  };
  const okres = c.width / 2;

  if (t.pasy) {
    for (let y = 0; y < d; y += 2) {
      const f = Math.sin(y / d * 18 + los() * 0.6) * 0.5 + Math.sin(y / d * 47) * 0.25;
      g.fillStyle = t.kolory[Math.floor((f + 1) * 1.99) % t.kolory.length];
      g.globalAlpha = 0.55;
      g.fillRect(0, y, c.width, 2);
    }
    g.globalAlpha = 1;
    plama(okres * 0.3, d * 0.62, d * 0.09, d * 0.05, '#b4552e', 0.8); // wielka burza
  } else {
    for (let i = 0; i < 70; i++) {
      const kolor = t.lad && los() < 0.5 ? t.lad : t.woda && los() < 0.3 ? t.woda : t.kolory[1 + Math.floor(los() * (t.kolory.length - 1))];
      plama(los() * okres, d * (0.1 + los() * 0.8), d * (0.03 + los() * 0.12), d * (0.02 + los() * 0.07), kolor, 0.55);
    }
    if (t.lawa) {
      for (let i = 0; i < 40; i++) plama(los() * okres, los() * d, d * 0.01 + los() * d * 0.02, d * 0.004 + los() * d * 0.01, t.lawa, 0.85);
    }
    // czapy polarne
    if (typ !== 'wulkaniczna' && typ !== 'pustynna') {
      g.globalAlpha = typ === 'lodowa' ? 0.9 : 0.6;
      g.fillStyle = '#f4f8fb';
      g.fillRect(0, 0, c.width, d * 0.06);
      g.fillRect(0, d * 0.94, c.width, d * 0.06);
      g.globalAlpha = 1;
    }
    for (let i = 0; i < 90 * (t.chmury || 0); i++) {
      plama(los() * okres, d * (0.05 + los() * 0.9), d * (0.05 + los() * 0.15), d * (0.006 + los() * 0.02), '#ffffff', 0.35);
    }
  }
  return c;
}

// Światła miast po nocnej stronie.
function teksturaSwiatel(d, ziarno) {
  const c = document.createElement('canvas');
  c.width = d * 2;
  c.height = d;
  const g = c.getContext('2d');
  const los = losowe(ziarno ^ 0x5bd1e995);
  for (let i = 0; i < d * 6; i++) {
    g.fillStyle = `rgba(255, ${190 + los() * 60 | 0}, 110, ${0.4 + los() * 0.6})`;
    const x = los() * d, y = d * (0.08 + los() * 0.84);
    g.fillRect(x, y, 1.2, 1.2);
    g.fillRect(x + d, y, 1.2, 1.2);
  }
  return c;
}

export function utworzScene(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let stan = { scena: 'kosmos', planeta: 'oceaniczna', odleglosc: 'srednio', zmieniono: 0 };
  let start = performance.now();
  let klatka = null;
  let gwiazdy = [];
  let tunel = [];
  let planeta = null; // { tekstura, swiatla, d, typ }
  const spokojnie = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rozmiar() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    planeta = null;
  }

  function noweGwiazdy() {
    gwiazdy = Array.from({ length: 420 }, () => ({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random(), pz: 0 }));
    tunel = Array.from({ length: 360 }, () => ({ a: Math.random() * Math.PI * 2, z: Math.random(), r: 0.6 + Math.random() * 0.8, j: Math.random() }));
  }

  function przygotujPlanete() {
    const typ = TYPY_PLANET[stan.planeta] ? stan.planeta : 'skalista';
    const d = Math.round(Math.min(w, h) * (ODLEGLOSCI[stan.odleglosc] || 0.5));
    if (planeta && planeta.typ === typ && planeta.d === d) return;
    const ziarno = hash((stan.miejsce || '') + typ);
    planeta = { typ, d, tekstura: teksturaPlanety(typ, Math.max(8, d), ziarno), swiatla: TYPY_PLANET[typ].swiatla ? teksturaSwiatel(Math.max(8, d), ziarno) : null };
  }

  // ---------- warstwy ----------

  function tlo(kolorSrodka = '#060b14') {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, kolorSrodka);
    g.addColorStop(1, '#010204');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Gwiazdy 3D: predkosc 0 = stoją, duże = smugi. Smuga = odcinek od poprzedniej pozycji.
  function rysujGwiazdy(predkosc, dt, jasnosc = 1, smugi = 1) {
    const cx = w / 2, cy = h / 2, skala = Math.max(w, h) * 0.6;
    for (const s of gwiazdy) {
      s.pz = s.z;
      s.z -= predkosc * dt;
      if (s.z <= 0.02) {
        s.x = (Math.random() - 0.5) * 2;
        s.y = (Math.random() - 0.5) * 2;
        s.z = 1;
        s.pz = 1;
      }
      const x = cx + (s.x / s.z) * skala, y = cy + (s.y / s.z) * skala;
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue;
      const a = Math.min(1, (1 - s.z) * 1.4) * jasnosc;
      const dlug = Math.min(1, smugi);
      const px = cx + (s.x / (s.z + (s.pz - s.z) * dlug * 18 + 0.0001)) * skala;
      const py = cy + (s.y / (s.z + (s.pz - s.z) * dlug * 18 + 0.0001)) * skala;
      const grubosc = Math.max(0.6, (1 - s.z) * 2.2);
      if (smugi > 0.15) {
        ctx.strokeStyle = `rgba(${200 + (1 - s.z) * 55 | 0}, ${225 + (1 - s.z) * 30 | 0}, 255, ${a})`;
        ctx.lineWidth = grubosc;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(220, 235, 255, ${a})`;
        ctx.fillRect(x, y, grubosc, grubosc);
      }
    }
  }

  // Tunel nadprzestrzeni: wirujące, niebiesko-białe smugi uciekające od środka.
  function rysujTunel(t, dt, sila = 1) {
    const cx = w / 2, cy = h / 2, R = Math.max(w, h) * 0.55;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.2);
    g.addColorStop(0, `rgba(235, 245, 255, ${0.9 * sila})`);
    g.addColorStop(0.08, `rgba(140, 190, 255, ${0.55 * sila})`);
    g.addColorStop(0.35, `rgba(30, 70, 160, ${0.45 * sila})`);
    g.addColorStop(1, `rgba(2, 6, 20, ${sila})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const wir = t * 0.00035;
    ctx.lineCap = 'round';
    for (const p of tunel) {
      p.z -= dt * 0.00055 * (0.7 + p.j * 0.6);
      if (p.z <= 0.03) {
        p.z = 1;
        p.a = Math.random() * Math.PI * 2;
      }
      const a = p.a + wir + (1 - p.z) * 0.9;
      const r1 = (p.r * R * 0.08) / p.z, r2 = (p.r * R * 0.08) / (p.z + 0.08);
      const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
      const x2 = cx + Math.cos(a - 0.12) * r2, y2 = cy + Math.sin(a - 0.12) * r2;
      const alfa = Math.min(1, (1 - p.z) * 1.6) * sila;
      ctx.strokeStyle = p.j > 0.85 ? `rgba(255, 255, 255, ${alfa})` : `rgba(${120 + p.j * 100 | 0}, ${170 + p.j * 70 | 0}, 255, ${alfa * 0.8})`;
      ctx.lineWidth = Math.max(0.8, (1 - p.z) * 4);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    // „mgła” tunelu: pulsujące pierścienie
    for (let i = 0; i < 3; i++) {
      const f = ((t * 0.00025 + i / 3) % 1);
      ctx.strokeStyle = `rgba(160, 200, 255, ${(1 - f) * 0.12 * sila})`;
      ctx.lineWidth = 30 * f + 4;
      ctx.beginPath();
      ctx.arc(cx, cy, f * R * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function rysujPlanete(t, pojawienie = 1) {
    przygotujPlanete();
    const { d, tekstura, swiatla, typ } = planeta;
    const r = d / 2;
    // Położenie: duża planeta wchodzi od dołu ekranu, mała wisi z boku.
    const blisko = stan.odleglosc === 'blisko';
    const cx = blisko ? w * 0.62 : w * 0.68;
    const cy = blisko ? h * 0.98 : h * 0.55;
    const skala = 0.85 + 0.15 * pojawienie;
    const R = r * skala;
    const info = TYPY_PLANET[typ];
    ctx.save();
    ctx.globalAlpha = pojawienie;
    // poświata atmosfery
    const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.25);
    glow.addColorStop(0, info.atmosfera + 'aa');
    glow.addColorStop(1, info.atmosfera + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
    ctx.fill();
    // powierzchnia (przewijana = obrót)
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    const przes = ((t * 0.004 * (spokojnie ? 0 : 1)) % d);
    ctx.drawImage(tekstura, przes, 0, d, d, cx - R, cy - R, R * 2, R * 2);
    // cień nocnej strony (światło z lewej góry)
    const cien = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.4, R * 0.15, cx - R * 0.2, cy - R * 0.2, R * 1.45);
    cien.addColorStop(0, 'rgba(0,0,0,0)');
    cien.addColorStop(0.45, 'rgba(0,0,0,0.25)');
    cien.addColorStop(0.75, 'rgba(0,0,0,0.75)');
    cien.addColorStop(1, 'rgba(0,0,0,0.97)');
    ctx.fillStyle = cien;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    if (swiatla) {
      // Światła miast tylko po nocnej stronie: rysujemy je na osobnym płótnie
      // i wygaszamy maską jaśniejszą od strony słońca.
      const p = document.createElement('canvas');
      p.width = p.height = Math.max(2, Math.ceil(R * 2));
      const g = p.getContext('2d');
      g.drawImage(swiatla, przes, 0, d, d, 0, 0, p.width, p.height);
      const maska = g.createRadialGradient(R * 0.55, R * 0.6, R * 0.2, R * 0.8, R * 0.8, R * 1.5);
      maska.addColorStop(0, 'rgba(0,0,0,0)');
      maska.addColorStop(0.55, 'rgba(0,0,0,0.3)');
      maska.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = maska;
      g.fillRect(0, 0, p.width, p.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(p, cx - R, cy - R);
      ctx.globalCompositeOperation = 'source-over';
    }
    // krawędź atmosfery
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = pojawienie * 0.6;
    ctx.strokeStyle = info.atmosfera;
    ctx.lineWidth = Math.max(1, R * 0.02);
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI * 0.75, Math.PI * 1.6);
    ctx.stroke();
    ctx.restore();
  }

  function blysk(alfa) {
    if (alfa <= 0) return;
    ctx.fillStyle = `rgba(235, 245, 255, ${Math.min(1, alfa)})`;
    ctx.fillRect(0, 0, w, h);
  }

  // ---------- pętla ----------

  let poprzednio = performance.now();
  function rysuj(teraz) {
    klatka = requestAnimationFrame(rysuj);
    const dt = Math.min(50, teraz - poprzednio);
    poprzednio = teraz;
    const t = teraz - start; // czas od wejścia w bieżącą scenę
    const ruch = spokojnie ? 0.15 : 1;

    switch (stan.scena) {
      case 'wejscie': {
        // 0–70%: gwiazdy przyspieszają i rozciągają się; 70–80%: błysk; potem tunel.
        const f = t / CZAS_WEJSCIA;
        if (f < 0.72) {
          tlo();
          const k = f / 0.72;
          rysujGwiazdy((0.00004 + Math.pow(k, 3) * 0.004) * ruch, dt, 1, 0.2 + k * 1.5);
        } else if (f < 1) {
          rysujTunel(t, dt, (f - 0.72) / 0.28);
          blysk(1 - (f - 0.72) / 0.28);
        } else {
          rysujTunel(t, dt);
        }
        break;
      }
      case 'nadswietlna':
        rysujTunel(t, dt * ruch);
        break;
      case 'wyjscie': {
        // 0–15%: błysk ze smug; 15–60%: smugi zwalniają; potem pojawia się planeta.
        const f = t / CZAS_WYJSCIA;
        tlo();
        const k = Math.min(1, f / 0.6);
        rysujGwiazdy((0.004 * Math.pow(1 - k, 2.2) + 0.00003) * ruch, dt, 1, 1.6 * (1 - k) + 0.05);
        if (f > 0.45) rysujPlanete(t, Math.min(1, (f - 0.45) / 0.55));
        blysk(f < 0.15 ? 1 - f / 0.15 : 0);
        break;
      }
      case 'orbita':
        tlo();
        rysujGwiazdy(0.000012 * ruch, dt, 0.9, 0.05);
        rysujPlanete(t, 1);
        break;
      default:
        tlo();
        rysujGwiazdy(0.00003 * ruch, dt, 1, 0.05);
    }
  }

  const obserwator = new ResizeObserver(() => rozmiar());
  obserwator.observe(canvas);
  rozmiar();
  noweGwiazdy();

  return {
    // Nowy stan z serwera. Animacje przejść grają tylko, jeśli zmiana jest świeża;
    // tablet włączony później od razu pokazuje stan końcowy.
    ustaw(nowy) {
      const zmiana = nowy.scena !== stan.scena || nowy.planeta !== stan.planeta || nowy.odleglosc !== stan.odleglosc || nowy.zmieniono !== stan.zmieniono;
      if (!zmiana) return;
      const swieza = Date.now() - (nowy.zmieniono || 0) < 15000;
      stan = { ...nowy };
      if (stan.scena === 'wejscie' && !swieza) stan.scena = 'nadswietlna';
      if (stan.scena === 'wyjscie' && !swieza) stan.scena = 'orbita';
      planeta = null;
      start = performance.now();
    },
    start() {
      if (klatka) return;
      poprzednio = performance.now();
      klatka = requestAnimationFrame(rysuj);
    },
    stop() {
      if (klatka) cancelAnimationFrame(klatka);
      klatka = null;
    },
  };
}
