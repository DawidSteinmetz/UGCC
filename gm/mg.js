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
  const zakladki = { konta: 'Konta', dokumenty: 'Dokumenty', holonet: 'Holonet', frakcje: 'Frakcje', harmonogram: 'Harmonogram' };
  const rysujMenu = () => wyczysc(menu).append(
    ...Object.entries(zakladki).map(([k, n]) => h('button' + (k === biezaca ? '.on' : ''), { onclick: () => { biezaca = k; rysujMenu(); otworz(); } }, n)),
    h('button', { onclick: async () => { await api('wyloguj', {}); location.reload(); } }, 'Wyloguj'));
  rysujMenu();
  otworz();
}

function otworz() {
  wyczysc(glowna);
  ({ konta, dokumenty, holonet, frakcje, harmonogram }[biezaca])().catch((e) => glowna.prepend(msg(e.message)));
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
