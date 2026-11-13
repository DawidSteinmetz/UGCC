// Panel MG: konta graczy, dokumenty dekodera, komunikaty holonetu, dane frakcji, harmonogram.
// To narzędzie poza światem gry, więc mówi normalnym językiem.

import { h, wyczysc } from '../js/rdzen/narzedzia.js';
import { api } from '../js/rdzen/api.js';

const FRAKCJE = ['Rebelia', 'Imperium', 'Syndykat'];
const glowna = document.getElementById('glowna');
const menu = document.getElementById('menu');
let biezaca = 'konta';

const msg = (t, rodzaj = 'blad') => h('div.msg.' + rodzaj, t);
const pole = (etykieta, el) => h('label', etykieta, el);
const btn = (tekst, fn, klasa = '') => h('button.btn' + klasa, { type: 'button', onclick: fn }, tekst);

function bezpiecznie(fn) {
  return async (...a) => {
    try {
      await fn(...a);
    } catch (e) {
      glowna.prepend(msg(e.message));
    }
  };
}

// ---------- start ----------

async function start() {
  let s;
  try {
    s = await api('stan');
  } catch (e) {
    wyczysc(glowna).append(msg('Brak połączenia z API: ' + e.message));
    return;
  }
  if (s.uzytkownik?.rola === 'mg') return panel(s.uzytkownik);
  if (!s.mgIstnieje) return zalozMG();
  logowanie(s.uzytkownik ? 'To konto nie ma uprawnień MG.' : '');
}

function logowanie(komunikat) {
  const login = h('input', { autocomplete: 'username' });
  const klucz = h('input', { type: 'password', autocomplete: 'current-password' });
  const info = h('div', komunikat ? msg(komunikat) : null);
  wyczysc(glowna).append(h('form.karta', {
    style: 'max-width:380px',
    onsubmit: async (e) => {
      e.preventDefault();
      try {
        const { uzytkownik } = await api('zaloguj', { login: login.value, klucz: klucz.value });
        if (uzytkownik.rola !== 'mg') return logowanie('To konto nie ma uprawnień MG.');
        panel(uzytkownik);
      } catch (err) {
        wyczysc(info).append(msg(err.message));
      }
    },
  }, h('h2', 'Logowanie MG'), info, pole('Login', login), h('br'), pole('Hasło', klucz), h('br'),
  h('button.btn.glowny', { type: 'submit' }, 'Zaloguj')));
}

function zalozMG() {
  const login = h('input');
  const klucz = h('input', { type: 'password', minlength: 8 });
  const info = h('div');
  wyczysc(glowna).append(h('form.karta', {
    style: 'max-width:420px',
    onsubmit: async (e) => {
      e.preventDefault();
      try {
        const { uzytkownik } = await api('mg_zaloz', { login: login.value, klucz: klucz.value });
        panel(uzytkownik);
      } catch (err) {
        wyczysc(info).append(msg(err.message));
      }
    },
  }, h('h2', 'Pierwsze uruchomienie'), h('p.slaby', 'Nie ma jeszcze konta MG. Załóż je teraz (hasło min. 8 znaków). Później ta opcja znika.'),
  info, pole('Login MG', login), h('br'), pole('Hasło', klucz), h('br'), h('button.btn.glowny', { type: 'submit' }, 'Załóż konto MG')));
}

function panel(u) {
  document.getElementById('kto').textContent = 'Zalogowano: ' + u.login;
  menu.hidden = false;
  const zakladki = { konta: 'Konta', bank: 'Bank', firmy: 'Firmy', katalog: 'Katalog', dokumenty: 'Dokumenty', holonet: 'Holonet', frakcje: 'Frakcje', harmonogram: 'Harmonogram' };
  const rysujMenu = () => wyczysc(menu).append(
    ...Object.entries(zakladki).map(([k, n]) => h('button' + (k === biezaca ? '.on' : ''), { onclick: () => { biezaca = k; rysujMenu(); otworz(); } }, n)),
    h('button', { onclick: async () => { await api('wyloguj', {}); location.reload(); } }, 'Wyloguj'));
  rysujMenu();
  otworz();
}

function otworz() {
  wyczysc(glowna);
  ({ konta, bank, firmy, katalog, dokumenty, holonet, frakcje, harmonogram }[biezaca])().catch((e) => glowna.prepend(msg(e.message)));
}

// ---------- konta ----------

async function konta(edytowany = null) {
  const { uzytkownicy } = await api('mg_uzytkownicy');
  const e = edytowany || {};
  const f = {
    login: h('input', { value: e.login || '' }),
    klucz: h('input', { type: 'text', placeholder: e.id ? 'zostaw puste = bez zmian' : 'wymagane' }),
    postac: h('input', { value: e.postac || '' }),
    frakcja: h('select', FRAKCJE.map((x) => h('option', { selected: e.frakcja === x }, x))),
    oddzial: h('input', { value: e.oddzial || '' }),
    ranga: h('input', { value: e.ranga || '' }),
    poziom: h('input', { type: 'number', min: 1, max: 9, value: e.poziom || 1 }),
    rola: h('select', h('option', { value: 'gracz', selected: e.rola !== 'mg' }, 'gracz'), h('option', { value: 'mg', selected: e.rola === 'mg' }, 'MG')),
  };
  const zapisz = bezpiecznie(async () => {
    const dane = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value]));
    await api('mg_uzytkownik_zapisz', { ...dane, id: e.id || '', poziom: Number(dane.poziom) });
    wyczysc(glowna);
    await konta();
    glowna.prepend(msg('Zapisano konto. Hasło przekaż graczowi osobno — w panelu nie da się go już odczytać.', 'ok'));
  });

  glowna.append(
    h('div.karta', h('h2', e.id ? `Edycja: ${e.login}` : 'Nowe konto gracza'),
      h('div.siatka', pole('Login', f.login), pole('Hasło', f.klucz), pole('Postać', f.postac), pole('Frakcja', f.frakcja),
        pole('Oddział', f.oddzial), pole('Ranga', f.ranga), pole('Poziom uprawnień (1–9)', f.poziom), pole('Rola', f.rola)),
      h('div.rzad', btn('Zapisz', zapisz, '.glowny'), e.id ? btn('Anuluj', () => { wyczysc(glowna); konta(); }) : null)),
    h('div.karta.przewijana', h('h2', `Konta (${uzytkownicy.length})`),
      h('table', h('tr', h('th', 'Login'), h('th', 'Postać'), h('th', 'Frakcja'), h('th', 'Oddział / ranga'), h('th', 'Poziom'), h('th', '')),
        uzytkownicy.map((x) => h('tr',
          h('td', x.login, x.rola === 'mg' ? h('span.slaby', ' (MG)') : null),
          h('td', x.postac), h('td', x.frakcja), h('td', [x.oddzial, x.ranga].filter(Boolean).join(' / ')), h('td', x.poziom),
          h('td.rzad',
            btn('Edytuj', () => { wyczysc(glowna); konta(x); }),
            btn('Usuń', bezpiecznie(async () => {
              if (!confirm(`Usunąć konto ${x.login}?`)) return;
              await api('mg_uzytkownik_usun', { id: x.id });
              wyczysc(glowna); await konta();
            }), '.zly')))))),
  );
}

// ---------- bank ----------

const kr = (n) => `${Number(n).toLocaleString('pl-PL')} kr`;
const TYPY_OPERACJI = { przelew: 'przelew', dochod: 'stały dochód', korekta: 'operacja MG' };

// Najbliższy termin wypłaty stałego dochodu (dzień miesiąca po ostatniej wypłacie).
function nastepnaWyplata(d) {
  const [r, m] = d.ostatnio.split('-').map(Number);
  const t = new Date(r, m, d.dzien); // miesiąc m (0-based) = miesiąc po „ostatnio”
  return t.toLocaleDateString('pl-PL');
}

async function bank(edytowany = null) {
  const { konta, dochody, transakcje } = await api('mg_bank');
  const nazwa = Object.fromEntries(konta.map((k) => [k.uid, k.postac]));
  const wyborPostaci = (wybrana) => h('select', konta.map((k) => h('option', { value: k.uid, selected: k.uid === wybrana }, `${k.postac} (${k.frakcja})`)));
  const odswiez = async (komunikat) => { wyczysc(glowna); await bank(); if (komunikat) glowna.prepend(msg(komunikat, 'ok')); };

  // Operacja jednorazowa
  const op = { uid: wyborPostaci(), kwota: h('input', { type: 'number', step: 1, placeholder: 'np. 500 albo -200' }), zrodlo: h('input', { placeholder: 'np. Nagroda Huttów' }), tytul: h('input') };
  const wykonaj = bezpiecznie(async () => {
    const kwota = Math.trunc(Number(op.kwota.value));
    if (!kwota) throw new Error('Podaj kwotę różną od zera (ujemna = obciążenie).');
    await api('mg_bank_korekta', { uid: op.uid.value, kwota, zrodlo: op.zrodlo.value, tytul: op.tytul.value });
    await odswiez(`Zaksięgowano ${kr(kwota)} dla: ${nazwa[op.uid.value]}.`);
  });

  // Stały dochód
  const e = edytowany || {};
  const doch = {
    uid: wyborPostaci(e.uid),
    kwota: h('input', { type: 'number', step: 1, value: e.kwota ?? '' }),
    dzien: h('input', { type: 'number', min: 1, max: 28, value: e.dzien ?? 1 }),
    zrodlo: h('input', { value: e.zrodlo || '', placeholder: 'np. Dowództwo Rebelii' }),
    tytul: h('input', { value: e.tytul || '', placeholder: 'np. Żołd miesięczny' }),
  };
  const zapiszDochod = bezpiecznie(async () => {
    const kwota = Math.trunc(Number(doch.kwota.value));
    if (!kwota) throw new Error('Podaj kwotę różną od zera (ujemna = stała opłata).');
    await api('mg_bank_dochod_zapisz', { id: e.id || '', uid: doch.uid.value, kwota, dzien: Number(doch.dzien.value), zrodlo: doch.zrodlo.value, tytul: doch.tytul.value });
    await odswiez('Zapisano stały dochód.');
  });

  glowna.append(
    h('div.karta.przewijana', h('h2', 'Rachunki postaci'),
      h('table', h('tr', h('th', 'Postać'), h('th', 'Frakcja'), h('th', 'Rachunek'), h('th', 'Saldo')),
        konta.map((k) => h('tr', h('td', k.postac), h('td', k.frakcja), h('td', k.numer), h('td', kr(k.saldo)))))),
    h('div.karta', h('h2', 'Operacja jednorazowa'),
      h('p.slaby', 'Wpłata (kwota dodatnia) albo obciążenie (ujemna). Gracz zobaczy „Źródło” jako nadawcę lub odbiorcę.'),
      h('div.siatka', pole('Postać', op.uid), pole('Kwota', op.kwota), pole('Źródło', op.zrodlo), pole('Tytuł', op.tytul)),
      btn('Zaksięguj', wykonaj, '.glowny')),
    h('div.karta', h('h2', e.id ? 'Edycja stałego dochodu' : 'Nowy stały dochód'),
      h('p.slaby', 'Wypłacany co miesiąc w podanym dniu (1–28). Kwota ujemna działa jak stała opłata. Nowy dochód wypłaca się pierwszy raz w najbliższym takim dniu. Jeśli nikt nie wchodził do banku, zaległe wypłaty dopiszą się przy pierwszym wejściu.'),
      h('div.siatka', pole('Postać', doch.uid), pole('Kwota miesięczna', doch.kwota), pole('Dzień miesiąca', doch.dzien), pole('Źródło (nadawca)', doch.zrodlo), pole('Tytuł', doch.tytul)),
      h('div.rzad', btn('Zapisz', zapiszDochod, '.glowny'), e.id ? btn('Anuluj', () => { wyczysc(glowna); bank(); }) : null)),
    h('div.karta.przewijana', h('h2', `Stałe dochody (${dochody.length})`),
      h('table', h('tr', h('th', 'Postać'), h('th', 'Kwota'), h('th', 'Dzień'), h('th', 'Źródło / tytuł'), h('th', 'Następna wypłata'), h('th', '')),
        dochody.map((d) => h('tr',
          h('td', nazwa[d.uid] || '(usunięta postać)'), h('td', kr(d.kwota)), h('td', d.dzien),
          h('td', d.zrodlo || '—', h('div.slaby', d.tytul || '')), h('td', nastepnaWyplata(d)),
          h('td.rzad',
            btn('Edytuj', () => { wyczysc(glowna); bank(d); }),
            btn('Usuń', bezpiecznie(async () => {
              if (!confirm('Usunąć stały dochód?')) return;
              await api('mg_bank_dochod_usun', { id: d.id });
              await odswiez('Usunięto.');
            }), '.zly')))))),
    h('div.karta.przewijana', h('h2', 'Ostatnie operacje'),
      h('table', h('tr', h('th', 'Czas'), h('th', 'Typ'), h('th', 'Od'), h('th', 'Do'), h('th', 'Kwota'), h('th', 'Tytuł')),
        transakcje.map((t) => h('tr', h('td', new Date(t.czas).toLocaleString('pl-PL')), h('td', TYPY_OPERACJI[t.typ] || t.typ),
          h('td', t.od_nazwa), h('td', t.do_nazwa), h('td', kr(t.kwota)), h('td', t.tytul || ''))))),
  );
}

// ---------- katalog: towary i planety ----------

const WZOR_TOWAROW = [
  { nazwa: 'Zboże', kategoria: 'żywność', masa: 1, jednostka: 't' },
  { nazwa: 'Ogniwa paliwowe', kategoria: 'paliwo', masa: 2, jednostka: 'skrzynia' },
  { nazwa: 'Części hipernapędu', kategoria: 'technika', masa: 5, jednostka: 'kontener' },
];
const WZOR_PLANET = [
  { nazwa: 'Zephyria', sektor: 'Zewnętrzne Rubieże' },
  { nazwa: 'Tatooine', sektor: 'Arkanis' },
];

async function katalog() {
  const { katalog: k } = await api('mg_katalog');
  const towary = h('textarea', { style: 'min-height:260px' }, JSON.stringify(k.towary, null, 2));
  const planety = h('textarea', { style: 'min-height:200px' }, JSON.stringify(k.planety, null, 2));
  const info = h('div');
  glowna.append(h('div.karta',
    h('h2', 'Katalog gry'),
    h('p.slaby', 'Wspólna lista dla całej gry: towary używają firmy (a później giełda), planety używa planowanie kursów (później dojdzie mapa). '
      + 'Pole „id” nadaje serwer — nie zmieniaj go, bo odwołują się do niego magazyny i kursy. Nowe pozycje dopisuj bez „id”. '
      + 'Towar: nazwa, kategoria, masa (t na jednostkę, liczba całkowita), jednostka.'),
    info,
    h('label', 'Towary', towary), h('br'),
    h('label', 'Planety', planety), h('br'),
    h('div.rzad',
      btn('Zapisz katalog', async () => {
        try {
          await api('mg_katalog_zapisz', { towary: JSON.parse(towary.value), planety: JSON.parse(planety.value) });
          wyczysc(glowna); await katalog();
          glowna.prepend(msg('Zapisano katalog.', 'ok'));
        } catch (e) {
          wyczysc(info).append(msg(e instanceof SyntaxError ? 'Błąd w JSON: ' + e.message : e.message));
        }
      }, '.glowny'),
      btn('Wstaw przykład', () => {
        if (towary.value.trim() === '[]') towary.value = JSON.stringify(WZOR_TOWAROW, null, 2);
        if (planety.value.trim() === '[]') planety.value = JSON.stringify(WZOR_PLANET, null, 2);
      }))));
}

// ---------- firmy ----------

const PROFILE_FIRM = { transport: 'Transport', komorka: 'Komórka' };
const ROLE_FIRMY = { wlasciciel: 'właściciel', menedzer: 'menedżer', pracownik: 'pracownik' };
const STATYSTYKI = { pilotaz: 'pilotaż', dowodzenie: 'dowodzenie', taktyka: 'taktyka', zarzadzanie: 'zarządzanie', logistyka: 'logistyka', lojalnosc: 'lojalność' };
const STATUS_KURSU = { szkic: 'szkic', zgloszony: 'CZEKA NA DECYZJĘ', w_realizacji: 'w trasie', zakonczony: 'zakończony', odrzucony: 'odrzucony' };

// Dane firmy do edytora: identyfikatory planet, towarów, statków i osób zamienione na nazwy.
function daneDoEdycji(d, kat) {
  const pl = Object.fromEntries(kat.planety.map((p) => [p.id, p.nazwa]));
  const tw = Object.fromEntries(kat.towary.map((t) => [t.id, t.nazwa]));
  const st = Object.fromEntries(d.flota.map((s) => [s.id, s.nazwa]));
  const os = Object.fromEntries(d.zaloga.map((z) => [z.id, z.imie]));
  const bu = Object.fromEntries((d.budynki || []).map((b) => [b.id, b.nazwa]));
  const wynik = {
    flota: d.flota.map((s) => ({ ...s, lokalizacja: pl[s.lokalizacja] || '', kapitan: os[s.kapitan] || '' })),
    zaloga: d.zaloga.map((z) => ({ ...z, statek: st[z.statek] || '', ...(d.budynki ? { budynek: bu[z.budynek] || '' } : {}) })),
    magazyn: d.magazyn.map((m) => ({ planeta: pl[m.planeta] || m.planeta, towar: tw[m.towar] || m.towar, ilosc: m.ilosc })),
  };
  if (d.budynki) wynik.budynki = d.budynki.map((b) => ({ ...b, planeta: pl[b.planeta] || '', menedzer: os[b.menedzer] || '' }));
  return wynik;
}

const WZOR_KOMORKI = {
  flota: [{ nazwa: 'Cień Zephyrii', klasa: 'korweta CR70', ladownosc: 60, stan: 'sprawny', lokalizacja: 'Zephyria', kapitan: 'Mara Dex' }],
  zaloga: [
    { imie: 'Mara Dex', funkcja: 'pilot', pensja: 0, statystyki: { pilotaz: 8, dowodzenie: 6, taktyka: 5, lojalnosc: 9 } },
    { imie: 'Orrin Vale', funkcja: 'inżynier', budynek: 'Kopalnia Kessa', statystyki: { zarzadzanie: 4, logistyka: 7, lojalnosc: 5 } },
    { imie: 'Sela', funkcja: 'strzelec' },
  ],
  magazyn: [{ planeta: 'Zephyria', towar: 'Ogniwa paliwowe', ilosc: 10 }],
  budynki: [{ nazwa: 'Kopalnia Kessa', typ: 'kopalnia', planeta: 'Zephyria', pojemnosc: 40, pracownicy: 12, pensja: 15, menedzer: 'Orrin Vale', opis: 'Wydobycie rudy w starych sztolniach.' }],
};

const WZOR_TRANSPORTU = {
  flota: [{ nazwa: 'Szary Wróbel', klasa: 'frachtowiec YT-1300', ladownosc: 100, stan: 'sprawny', lokalizacja: 'Zephyria', kapitan: 'Dax Morrow' }],
  zaloga: [
    { imie: 'Dax Morrow', funkcja: 'pilot', pensja: 300, statek: 'Szary Wróbel' },
    { imie: 'R5-K2', funkcja: 'droid astromechaniczny', pensja: 0, statek: '' },
  ],
  magazyn: [{ planeta: 'Zephyria', towar: 'Zboże', ilosc: 40 }],
};

async function firmy() {
  const { firmy: lista, katalog: kat } = await api('mg_firmy');
  const { uzytkownicy } = await api('mg_uzytkownicy');
  const gracze = uzytkownicy.filter((u) => u.rola !== 'mg');
  const postac = Object.fromEntries(uzytkownicy.map((u) => [u.id, u.postac]));
  const odswiez = async (t) => { wyczysc(glowna); await firmy(); if (t) glowna.prepend(msg(t, 'ok')); };

  // Kursy czekające na decyzję — na górze, bo to codzienna robota MG.
  const czekajace = lista.flatMap((f) => (f.dane.szlaki || [])
    .filter((s) => ['zgloszony', 'w_realizacji'].includes(s.status)).map((s) => ({ f, s })));
  if (czekajace.length) {
    const pl = Object.fromEntries(kat.planety.map((p) => [p.id, p.nazwa]));
    const tw = Object.fromEntries(kat.towary.map((t) => [t.id, t.nazwa]));
    glowna.append(h('div.karta', h('h2', `Kursy do obsłużenia (${czekajace.length})`),
      czekajace.map(({ f, s }) => {
        const uwagi = h('input', { placeholder: 'uwagi dla graczy (np. powód odrzucenia)' });
        const statek = f.dane.flota.find((x) => x.id === s.statek)?.nazwa || '?';
        const zmien = (status, pytanie) => bezpiecznie(async () => {
          if (pytanie && !confirm(pytanie)) return;
          await api('mg_szlak_status', { firma: f.id, szlak: s.id, status, uwagi: uwagi.value });
          await odswiez('Zmieniono status kursu.');
        });
        return h('div', { style: 'border-top:1px solid var(--linia);padding:12px 0' },
          h('div', h('b', `${f.nazwa}: ${s.nazwa}`), h('span.slaby', `  · ${statek} · ${STATUS_KURSU[s.status]} · zgłosił(a) ${s.autor || '?'}`)),
          h('ol', { style: 'margin:6px 0' }, s.przystanki.map((p) => h('li', pl[p.planeta] || '?',
            p.operacje.length ? h('span.slaby', ' — ' + p.operacje.map((o) => `${o.typ === 'zaladunek' ? 'załaduj' : 'rozładuj'} ${o.ilosc} × ${tw[o.towar] || '?'}`).join(', ')) : null))),
          s.notatka ? h('div.slaby', 'Notatka graczy: ' + s.notatka) : null,
          h('div.rzad', { style: 'margin-top:8px' },
            h('div', { style: 'flex:1;min-width:220px' }, uwagi),
            s.status === 'zgloszony' ? btn('Przyjmij (w trasie)', zmien('w_realizacji'), '.glowny') : null,
            s.status === 'w_realizacji' ? btn('Zakończ i rozlicz', zmien('zakonczony', 'Zakończyć kurs? Magazyny i położenie statku zmienią się zgodnie z planem.'), '.glowny') : null,
            btn('Odrzuć', zmien('odrzucony'), '.zly')));
      })));
  }

  // Misje komórek: zatwierdzenie przed sesją, ręczne rozliczenie po sesji.
  const misje = lista.flatMap((f) => (f.dane.misje || [])
    .filter((m) => ['zgloszona', 'zatwierdzona'].includes(m.status)).map((m) => ({ f, m })));
  if (misje.length) {
    glowna.append(h('div.karta', h('h2', `Misje do obsłużenia (${misje.length})`), misje.map(({ f, m }) => kartaMisji(f, m, kat, odswiez))));
  }

  // Edytor jednej firmy (nowej albo istniejącej).
  const edytor = (f) => {
    const nowa = !f;
    f = f || { id: '', nazwa: '', profil: 'transport', czlonkowie: [], dane: { flota: [], zaloga: [], magazyn: [] } };
    // Nowa firma: zmiana profilu podmienia pusty szablon danych (komórka ma też budynki).
    const pustyDlaProfilu = (p) => JSON.stringify(p === 'komorka' ? { flota: [], zaloga: [], magazyn: [], budynki: [] } : { flota: [], zaloga: [], magazyn: [] }, null, 2);
    const nazwa = h('input', { value: f.nazwa });
    const profil = h('select', { disabled: !nowa }, Object.entries(PROFILE_FIRM).map(([k, n]) => h('option', { value: k, selected: k === f.profil }, n)));
    const czlonkowie = h('div');
    const wiersze = [];
    const dodajCzlonka = (c = { uid: gracze[0]?.id, rola: 'pracownik' }) => {
      const kto = h('select', gracze.map((u) => h('option', { value: u.id, selected: u.id === c.uid }, `${u.postac} (${u.login})`)));
      const rola = h('select', Object.entries(ROLE_FIRMY).map(([k, n]) => h('option', { value: k, selected: k === c.rola }, n)));
      const wiersz = h('div.rzad', { style: 'margin-bottom:6px' }, h('div', { style: 'flex:2' }, kto), h('div', { style: 'flex:1' }, rola),
        btn('×', () => { wiersz.remove(); wiersze.splice(wiersze.indexOf(para), 1); }, '.zly'));
      const para = { kto, rola };
      wiersze.push(para);
      czlonkowie.append(wiersz);
    };
    f.czlonkowie.forEach(dodajCzlonka);
    const dane = h('textarea', { style: 'min-height:320px' }, JSON.stringify(daneDoEdycji(f.dane, kat), null, 2));
    if (nowa) profil.addEventListener('change', () => { dane.value = pustyDlaProfilu(profil.value); });
    const info = h('div');
    const zapisz = async () => {
      try {
        await api('mg_firma_zapisz', {
          id: f.id, nazwa: nazwa.value, profil: profil.value,
          czlonkowie: wiersze.map((w) => ({ uid: w.kto.value, rola: w.rola.value })),
          dane: JSON.parse(dane.value),
        });
        await odswiez(`Zapisano firmę ${nazwa.value}.`);
      } catch (e) {
        wyczysc(info).append(msg(e instanceof SyntaxError ? 'Błąd w JSON: ' + e.message : e.message));
      }
    };
    return h('div.karta',
      h('h2', nowa ? 'Nowa firma' : f.nazwa),
      info,
      h('div.siatka', pole('Nazwa', nazwa), pole('Profil', profil)),
      h('label', 'Członkowie (właściciel i menedżer mogą planować kursy i zmieniać przydziały; pracownik tylko podgląda)'),
      czlonkowie,
      btn('+ Członek', () => dodajCzlonka()), h('br'), h('br'),
      h('label', 'Flota, załoga, magazyn' + (f.profil === 'komorka' || nowa ? ' (w komórce także budynki)' : '') + ' — JSON. Planety, towary, statki, budynki i osoby wpisuj po nazwie. '
        + 'Stany statku: sprawny, uszkodzony, w naprawie. Stan osoby: zdrowy, ranny. '
        + 'Ukryte „statystyki” osób (1–10): ' + Object.entries(STATYSTYKI).map(([k, n]) => `${k} (${n})`).join(', ') + '. Gracze ich nie widzą — poznają je w przybliżeniu testem.', dane),
      h('br'),
      h('div.rzad',
        btn('Zapisz', zapisz, '.glowny'),
        btn('Wstaw przykład', () => { dane.value = JSON.stringify(profil.value === 'komorka' ? WZOR_KOMORKI : WZOR_TRANSPORTU, null, 2); }),
        nowa ? null : btn('Usuń firmę', bezpiecznie(async () => {
          if (!confirm(`Usunąć firmę ${f.nazwa} razem z flotą i magazynami?`)) return;
          await api('mg_firma_usun', { id: f.id });
          await odswiez('Usunięto firmę.');
        }), '.zly')));
  };

  glowna.append(h('div.karta',
    h('h2', `Firmy (${lista.length})`),
    lista.length
      ? h('table', h('tr', h('th', 'Nazwa'), h('th', 'Profil'), h('th', 'Członkowie'), h('th', 'Statki'), h('th', '')),
        lista.map((f) => h('tr', h('td', f.nazwa), h('td', PROFILE_FIRM[f.profil] || f.profil),
          h('td', f.czlonkowie.map((c) => `${postac[c.uid] || '?'} (${ROLE_FIRMY[c.rola]})`).join(', ') || '—'),
          h('td', f.dane.flota?.length ?? 0),
          h('td', btn('Edytuj', () => { const e = edytor(f); glowna.querySelector('#edytor-firmy').replaceChildren(e); e.scrollIntoView(); })))))
      : h('p.slaby', 'Brak firm. Najpierw uzupełnij katalog (towary, planety), potem załóż firmę.')),
  h('div#edytor-firmy', edytor(null)));
}

function kartaMisji(f, m, kat, odswiez) {
  const pl = Object.fromEntries(kat.planety.map((p) => [p.id, p.nazwa]));
  const statki = f.dane.flota.filter((s) => m.statki.includes(s.id));
  const ludzie = f.dane.zaloga.filter((z) => m.zaloga.includes(z.id));
  const statystyki = (z) => Object.entries(z.statystyki || {}).map(([k, v]) => `${STATYSTYKI[k] || k} ${v}`).join(', ');
  const uwagi = h('input', { placeholder: 'uwagi dla graczy (np. powód odrzucenia)' });
  const zmienStatus = (status, pytanie) => bezpiecznie(async () => {
    if (pytanie && !confirm(pytanie)) return;
    await api('mg_misja_status', { firma: f.id, misja: m.id, status, uwagi: uwagi.value });
    await odswiez('Zmieniono status misji.');
  });

  const naglowek = h('div',
    h('div', h('b', `${f.nazwa}: ${m.nazwa}`), h('span.slaby', `  · ${m.status === 'zgloszona' ? 'CZEKA NA ZATWIERDZENIE' : 'ZATWIERDZONA — do rozliczenia po sesji'} · termin ${m.termin} · ${pl[m.planeta] || 'bez rejonu'} · zgłosił(a) ${m.autor || '?'}`)),
    h('div', { style: 'white-space:pre-wrap;margin:6px 0' }, m.cel));

  if (m.status === 'zgloszona') {
    return h('div', { style: 'border-top:1px solid var(--linia);padding:12px 0' }, naglowek,
      h('div.slaby', 'Statki: ' + (statki.map((s) => s.nazwa).join(', ') || '—')),
      h('div.slaby', 'Ludzie: ' + (ludzie.map((z) => z.imie + (z.statystyki && Object.keys(z.statystyki).length ? ` [${statystyki(z)}]` : '')).join(', ') || '—')),
      h('div.rzad', { style: 'margin-top:8px' }, h('div', { style: 'flex:1;min-width:220px' }, uwagi),
        btn('Zatwierdź', zmienStatus('zatwierdzona'), '.glowny'), btn('Odrzuć', zmienStatus('odrzucona'), '.zly')));
  }

  // Rozliczenie: wynik dla każdego statku i człowieka, zmiany w magazynach, raport.
  const wybor = (opcje, dom) => h('select', Object.entries(opcje).map(([k, n]) => h('option', { value: k, selected: k === dom }, n)));
  const wynStatkow = Object.fromEntries(statki.map((s) => [s.id, wybor({ sprawny: 'wrócił sprawny', uszkodzony: 'uszkodzony', zniszczony: 'ZNISZCZONY' }, 'sprawny')]));
  const wynLudzi = Object.fromEntries(ludzie.map((z) => [z.id, wybor({ zdrowy: 'cały', ranny: 'ranny', zginal: 'ZGINĄŁ' }, 'zdrowy')]));
  const wracaNa = h('select', h('option', { value: '' }, 'tam, skąd wyleciały'), kat.planety.map((p) => h('option', { value: p.id }, p.nazwa)));
  const lupy = h('div');
  const dodajLup = () => {
    const planeta = h('select', kat.planety.map((p) => h('option', { value: p.id }, p.nazwa)));
    const towar = h('select', kat.towary.map((t) => h('option', { value: t.id }, t.nazwa)));
    const ilosc = h('input', { type: 'number', step: 1, placeholder: '+ łup / − strata' });
    const wiersz = h('div.rzad', { style: 'margin-bottom:6px' }, h('div', { style: 'flex:1' }, planeta), h('div', { style: 'flex:1' }, towar), h('div', { style: 'width:140px' }, ilosc), btn('×', () => wiersz.remove(), '.zly'));
    wiersz._dane = () => ({ planeta: planeta.value, towar: towar.value, ilosc: Math.trunc(Number(ilosc.value) || 0) });
    lupy.append(wiersz);
  };
  const raport = h('textarea', { style: 'font-family:inherit', placeholder: 'Raport dla graczy: co się wydarzyło na sesji' });
  const rozlicz = bezpiecznie(async () => {
    const straty = [...Object.values(wynStatkow), ...Object.values(wynLudzi)].filter((s) => ['zniszczony', 'zginal'].includes(s.value)).length;
    if (!confirm(`Rozliczyć misję „${m.nazwa}”?${straty ? ` Trwałe straty: ${straty}.` : ''} Tego nie da się cofnąć.`)) return;
    await api('mg_misja_rozlicz', {
      firma: f.id, misja: m.id, raport: raport.value, wraca_na: wracaNa.value,
      statki: Object.fromEntries(Object.entries(wynStatkow).map(([k, s]) => [k, s.value])),
      zaloga: Object.fromEntries(Object.entries(wynLudzi).map(([k, s]) => [k, s.value])),
      lup: [...lupy.children].map((w) => w._dane()).filter((l) => l.ilosc),
    });
    await odswiez('Misja rozliczona.');
  });

  return h('div', { style: 'border-top:1px solid var(--linia);padding:12px 0' }, naglowek,
    h('table', h('tr', h('th', 'Siły'), h('th', 'Ukryte statystyki'), h('th', 'Wynik')),
      statki.map((s) => h('tr', h('td', s.nazwa, h('span.slaby', ` (${s.klasa || 'statek'})`)), h('td.slaby', '—'), h('td', wynStatkow[s.id]))),
      ludzie.map((z) => h('tr', h('td', z.imie, h('span.slaby', ` (${z.funkcja || ''})`)), h('td.slaby', statystyki(z) || '—'), h('td', wynLudzi[z.id])))),
    h('br'),
    h('div.siatka', pole('Statki kończą na', wracaNa)),
    h('label', 'Łup i straty w magazynach'), lupy, btn('+ Pozycja', dodajLup), h('br'), h('br'),
    pole('Raport', raport), h('br'),
    h('div.rzad', btn('Rozlicz misję', rozlicz, '.glowny'), h('div', { style: 'flex:1;min-width:200px' }, uwagi), btn('Odwołaj misję', zmienStatus('odrzucona', 'Odwołać misję? Siły wrócą do gotowości.'), '.zly')));
}

// ---------- dokumenty dekodera ----------

async function dokumenty(edytowany = null) {
  const { dokumenty: lista } = await api('mg_dokumenty');
  const e = edytowany || {};
  const f = {
    sygnatura: h('input', { value: e.sygnatura || '', placeholder: 'np. XK-7741' }),
    tytul: h('input', { value: e.tytul || '' }),
    poziom: h('input', { type: 'number', min: 1, max: 9, value: e.poziom || 1 }),
    frakcja: h('select', h('option', { value: '' }, 'dowolna'), FRAKCJE.map((x) => h('option', { selected: e.frakcja === x }, x))),
    tresc: h('textarea', { style: 'min-height:220px;font-family:inherit' }, e.tresc || ''),
  };
  const zapisz = bezpiecznie(async () => {
    await api('mg_dokument_zapisz', {
      sygnatura: f.sygnatura.value, tytul: f.tytul.value, poziom: Number(f.poziom.value),
      frakcja: f.frakcja.value, tresc: f.tresc.value, stara: e.sygnatura || '',
    });
    wyczysc(glowna);
    await dokumenty();
    glowna.prepend(msg('Zapisano. Podaj graczowi sygnaturę — wpisze ją w Dekoderze.', 'ok'));
  });
  glowna.append(
    h('div.karta', h('h2', e.sygnatura ? `Edycja: ${e.sygnatura}` : 'Nowy dokument'),
      h('div.siatka', pole('Sygnatura', f.sygnatura), pole('Tytuł', f.tytul), pole('Wymagany poziom', f.poziom), pole('Tylko dla frakcji', f.frakcja)),
      pole('Treść', f.tresc), h('br'),
      h('div.rzad', btn('Zapisz', zapisz, '.glowny'), e.sygnatura ? btn('Anuluj', () => { wyczysc(glowna); dokumenty(); }) : null)),
    h('div.karta.przewijana', h('h2', `Dokumenty (${lista.length})`),
      h('table', h('tr', h('th', 'Sygnatura'), h('th', 'Tytuł'), h('th', 'Poziom'), h('th', 'Frakcja'), h('th', '')),
        lista.map((d) => h('tr', h('td', d.sygnatura), h('td', d.tytul), h('td', d.poziom), h('td', d.frakcja || '—'),
          h('td.rzad',
            btn('Edytuj', () => { wyczysc(glowna); dokumenty(d); }),
            btn('Usuń', bezpiecznie(async () => {
              if (!confirm(`Usunąć ${d.sygnatura}?`)) return;
              await api('mg_dokument_usun', { sygnatura: d.sygnatura });
              wyczysc(glowna); await dokumenty();
            }), '.zly')))))),
  );
}

// ---------- holonet ----------

async function holonet(edytowany = null) {
  const { komunikaty } = await api('holonet');
  const e = edytowany || {};
  const f = {
    tytul: h('input', { value: e.tytul || '' }),
    zrodlo: h('input', { value: e.zrodlo || '', placeholder: 'np. Imperialne Biuro Informacji' }),
    data: h('input', { type: 'date', value: e.data || new Date().toISOString().slice(0, 10) }),
    tresc: h('textarea', { style: 'font-family:inherit' }, e.tresc || ''),
  };
  const zapisz = bezpiecznie(async () => {
    await api('mg_holonet_zapisz', { id: e.id || '', tytul: f.tytul.value, zrodlo: f.zrodlo.value, data: f.data.value, tresc: f.tresc.value });
    wyczysc(glowna); await holonet();
    glowna.prepend(msg('Opublikowano w holonecie.', 'ok'));
  });
  glowna.append(
    h('div.karta', h('h2', e.id ? 'Edycja komunikatu' : 'Nowy komunikat holonetu'),
      h('div.siatka', pole('Tytuł', f.tytul), pole('Źródło', f.zrodlo), pole('Data', f.data)),
      pole('Treść', f.tresc), h('br'),
      h('div.rzad', btn('Opublikuj', zapisz, '.glowny'), e.id ? btn('Anuluj', () => { wyczysc(glowna); holonet(); }) : null)),
    h('div.karta', h('h2', `Komunikaty (${komunikaty.length})`),
      h('table', komunikaty.map((k) => h('tr', h('td', k.data), h('td', k.tytul, h('div.slaby', k.zrodlo || '')),
        h('td.rzad',
          btn('Edytuj', () => { wyczysc(glowna); holonet(k); }),
          btn('Usuń', bezpiecznie(async () => {
            if (!confirm('Usunąć komunikat?')) return;
            await api('mg_holonet_usun', { id: k.id });
            wyczysc(glowna); await holonet();
          }), '.zly')))))),
  );
}

// ---------- frakcje ----------

const WZOR_FRAKCJI = {
  planety: [{ nazwa: 'Zephyria', opis: 'Opis planety', instalacje: [{ nazwa: 'Kantyna', typ: 'punkt kontaktowy', stan: 'aktywna' }] }],
  zasoby: [{ nazwa: 'Ogniwa paliwowe', miejsce: 'Hangar 3', ilosc: 12, jednostka: 'szt.' }],
  kadry: [{ imie: 'Dowódca', ranga: 'Pułkownik', funkcja: 'Dowodzenie', przelozony: '' }, { imie: 'Zastępca', ranga: 'Major', przelozony: 'Dowódca' }],
};

async function frakcje() {
  const { frakcje: wszystkie } = await api('mg_frakcje');
  for (const nazwa of FRAKCJE) {
    const pole = h('textarea', { style: 'min-height:280px' }, JSON.stringify(wszystkie[nazwa], null, 2));
    const info = h('div');
    glowna.append(h('div.karta',
      h('h2', nazwa),
      h('p.slaby', 'Dane w formacie JSON: listy „planety", „zasoby" i „kadry". W kadrach „przelozony" to imię innej osoby z listy — z tego powstaje drzewo dowodzenia.'),
      info, pole, h('br'),
      h('div.rzad',
        btn('Zapisz', async () => {
          try {
            const dane = JSON.parse(pole.value);
            await api('mg_frakcja_zapisz', { frakcja: nazwa, dane });
            wyczysc(info).append(msg('Zapisano.', 'ok'));
          } catch (e) {
            wyczysc(info).append(msg(e instanceof SyntaxError ? 'Błąd w JSON: ' + e.message : e.message));
          }
        }, '.glowny'),
        btn('Wstaw przykład', () => { pole.value = JSON.stringify(WZOR_FRAKCJI, null, 2); }))));
  }
}

// ---------- harmonogram ----------

async function harmonogram() {
  const { wpisy } = await api('harmonogram');
  wpisy.sort((a, b) => a.data.localeCompare(b.data) || a.postac.localeCompare(b.postac));
  const csv = () => {
    const wiersze = [['data', 'postac', 'status', 'notatka'], ...wpisy.map((w) => [w.data, w.postac, w.status, w.notatka])];
    const tekst = '﻿' + wiersze.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([tekst], { type: 'text/csv' })), download: 'harmonogram.csv' });
    a.click();
  };
  glowna.append(h('div.karta.przewijana',
    h('div.rzad', h('h2', { style: 'flex:1' }, `Harmonogram (${wpisy.length})`), btn('Eksport do Excela (CSV)', csv)),
    h('table', h('tr', h('th', 'Data'), h('th', 'Postać'), h('th', 'Status'), h('th', 'Notatka'), h('th', '')),
      wpisy.map((w) => h('tr', h('td', w.data), h('td', w.postac), h('td', w.status), h('td', w.notatka || ''),
        h('td', btn('Usuń', bezpiecznie(async () => {
          await api('harmonogram_usun', { id: w.id });
          wyczysc(glowna); await harmonogram();
        }), '.zly')))))));
}

start();
