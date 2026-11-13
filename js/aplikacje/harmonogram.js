// Harmonogram: deklaracje obecności postaci na kolejne dni.

import { h, wyczysc, iso, zIso, dataGST, miesiacGST, DNI_TYG } from '../rdzen/narzedzia.js';
import { api } from '../rdzen/api.js';

const STATUSY = {
  dostepny: 'Dostępny',
  niepewny: 'Niepewny',
  nieobecny: 'Nieobecny',
};

export default {
  id: 'harmonogram',
  nazwa: 'Harmonogram',
  ikona: '<rect x="8" y="12" width="32" height="28" rx="2"/><path d="M8 20h32M16 8v8M32 8v8M15 27h4M22 27h4M29 27h4M15 33h4M22 33h4"/>',

  uruchom(w, ctx) {
    const dzis = new Date();
    let miesiac = new Date(dzis.getFullYear(), dzis.getMonth(), 1);
    let wybrany = iso(dzis);
    let wpisy = [];

    const kalendarz = h('div');
    const szczegoly = h('div');
    const komunikat = h('div');
    const tytulMiesiaca = h('h2', { style: 'margin:0' });

    async function wczytaj() {
      try {
        ({ wpisy } = await api('harmonogram'));
        rysuj();
      } catch (e) {
        wyczysc(komunikat).append(h('div.komunikat.blad', e.message));
      }
    }

    function rysuj() {
      tytulMiesiaca.textContent = miesiacGST(miesiac);
      const siatka = h('div.miesiac', DNI_TYG.map((d) => h('div.dzien-tyg', d)));
      // Tydzień zaczyna się w poniedziałek.
      const start = new Date(miesiac);
      start.setDate(1 - ((miesiac.getDay() + 6) % 7));
      for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const klucz = iso(d);
        const tego = wpisy.filter((x) => x.data === klucz);
        const klasy = ['dzien'];
        if (d.getMonth() !== miesiac.getMonth()) klasy.push('inny');
        if (klucz === iso(dzis)) klasy.push('dzis');
        if (klucz === wybrany) klasy.push('wybrany');
        siatka.append(h('button.' + klasy.join('.'), { onclick: () => { wybrany = klucz; rysuj(); } },
          h('span', d.getDate()),
          h('span.kropki', tego.map((x) => h('i.kropka.' + x.status)))));
      }
      wyczysc(kalendarz).append(siatka);
      rysujSzczegoly();
    }

    function rysujSzczegoly() {
      const tego = wpisy.filter((x) => x.data === wybrany).sort((a, b) => a.postac.localeCompare(b.postac));
      const moj = tego.find((x) => x.uid === ctx.uzytkownik.id);
      const status = h('select', Object.entries(STATUSY).map(([k, v]) => h('option', { value: k, selected: moj?.status === k }, v)));
      const notatka = h('input', { maxlength: 300, value: moj?.notatka || '' });

      wyczysc(szczegoly).append(
        h('div.panel',
          h('h2', dataGST(zIso(wybrany))),
          tego.length
            ? h('ul.lista', tego.map((x) => h('li', h('div.rzad',
              h('div.rozpycha', h('div', x.postac), x.notatka ? h('div.slaby.maly-tekst', x.notatka) : null),
              h('span.status-' + x.status, STATUSY[x.status]),
              (x.uid === ctx.uzytkownik.id || ctx.uzytkownik.rola === 'mg')
                ? h('button.przycisk.zly.maly', { onclick: () => usun(x.id), 'aria-label': 'Usuń' }, '×') : null))))
            : h('div.pusto', 'Brak deklaracji na ten dzień.')),
        h('form.panel', {
          onsubmit: async (e) => {
            e.preventDefault();
            try {
              await api('harmonogram_dodaj', { data: wybrany, status: status.value, notatka: notatka.value });
              wyczysc(komunikat).append(h('div.komunikat.ok', 'Deklaracja zapisana.'));
              await wczytaj();
            } catch (err) {
              wyczysc(komunikat).append(h('div.komunikat.blad', err.message));
            }
          },
        },
        h('h2', moj ? 'Zmień deklarację' : 'Zgłoś obecność'),
        h('div.pole', h('label', 'Status'), status),
        h('div.pole', h('label', 'Notatka'), notatka),
        h('button.przycisk', { type: 'submit' }, 'Zapisz')),
        komunikat,
      );
    }

    async function usun(id) {
      try {
        await api('harmonogram_usun', { id });
        await wczytaj();
      } catch (e) {
        wyczysc(komunikat).append(h('div.komunikat.blad', e.message));
      }
    }

    const przesun = (o) => { miesiac = new Date(miesiac.getFullYear(), miesiac.getMonth() + o, 1); rysuj(); };

    w.append(
      h('div.app-glowa', h('h1', 'Harmonogram'), h('span.podtytul', ctx.uzytkownik.postac)),
      h('div.dwie-kolumny', { style: 'grid-template-columns: 1fr minmax(260px, 340px)' },
        h('div.panel',
          h('div.rzad', { style: 'margin-bottom:12px' },
            h('button.przycisk.drugi.maly', { onclick: () => przesun(-1), 'aria-label': 'Poprzedni' }, '◁'),
            h('div.rozpycha', { style: 'text-align:center' }, tytulMiesiaca),
            h('button.przycisk.drugi.maly', { onclick: () => przesun(1), 'aria-label': 'Następny' }, '▷')),
          kalendarz),
        szczegoly),
    );
    rysuj();
    wczytaj();
  },
};
