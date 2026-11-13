// Profil firmy: przewozy (transport). Zakładki: Flota, Magazyn, Załoga, Szlaki.
//
// Kontekst `f` od aplikacji Firma:
//   f.firma { nazwa, dane: { flota, zaloga, magazyn, szlaki }, czlonkowie }
//   f.katalog { towary, planety }   wspólny katalog gry (ten sam użyje giełda)
//   f.moze                           czy wolno zmieniać (właściciel / menedżer)
//   f.operacja(op, dane)             zmiana danych firmy przez API
//   f.wczytaj()                      świeże dane firmy

import { h, wyczysc } from '../../rdzen/narzedzia.js';

const STATUS_KURSU = {
  szkic: ['Szkic', ''],
  zgloszony: ['Czeka na zgodę kontroli ruchu', 'status-niepewny'],
  w_realizacji: ['W trasie', 'status-dostepny'],
  zakonczony: ['Zakończony', 'slaby'],
  odrzucony: ['Odrzucony', 'status-nieobecny'],
};

const STAN_STATKU = {
  sprawny: 'status-dostepny',
  'w trasie': 'status-niepewny',
  uszkodzony: 'status-nieobecny',
  'w naprawie': 'status-niepewny',
};

export default {
  nazwa: 'Przewozy',

  uruchom(obszar, f) {
    let zakladka = 'flota';
    let dane = f.firma.dane;
    let edytor = null; // otwarty plan kursu
    let licznikSprawdzania = null;

    const planety = Object.fromEntries(f.katalog.planety.map((p) => [p.id, p]));
    const towary = Object.fromEntries(f.katalog.towary.map((t) => [t.id, t]));
    const nazwaPlanety = (id) => planety[id]?.nazwa || '—';
    const komunikat = h('div');
    const pokaz = (t, rodzaj = 'blad') => wyczysc(komunikat).append(h('div.komunikat.' + rodzaj, t));

    async function odswiez() {
      const d = await f.wczytaj();
      dane = d.firma.dane;
      rysuj();
    }

    async function wykonaj(op, d, ok) {
      try {
        const wynik = await f.operacja(op, d);
        await odswiez();
        if (ok) pokaz(ok, 'ok');
        return wynik;
      } catch (e) {
        pokaz(e.message);
        return null;
      }
    }

    const zakladki = h('div.zakladki');
    const tresc = h('div');
    obszar.append(zakladki, komunikat, tresc);

    function rysuj() {
      wyczysc(zakladki).append(...[['flota', 'Flota'], ['magazyn', 'Magazyn'], ['zaloga', 'Załoga'], ['szlaki', 'Szlaki']].map(([k, n]) =>
        h('button' + (k === zakladka ? '.aktywna' : ''), { onclick: () => { zakladka = k; edytor = null; wyczysc(komunikat); rysuj(); } }, n)));
      f.ustawWstecz(edytor ? () => { edytor = null; rysuj(); return true; } : f.wrocDoListy);
      wyczysc(tresc).append(edytor ? edytorKursu() : { flota, magazyn, zaloga, szlaki }[zakladka]());
    }

    // ---------- flota ----------

    function flota() {
      if (!dane.flota.length) return h('div.panel', h('div.pusto', 'Firma nie posiada statków.'));
      const zalogaNa = (sid) => dane.zaloga.filter((z) => z.statek === sid);
      return h('div.karty', dane.flota.map((s) => {
        const kapitan = dane.zaloga.find((z) => z.id === s.kapitan);
        const ladunek = (wiersz, wartosc) => h('tr', h('th', wiersz), h('td', wartosc));
        return h('div.panel',
          h('div.rzad', h('h2.rozpycha', { style: 'margin:0' }, s.nazwa),
            f.moze ? h('button.przycisk.drugi.maly', { onclick: () => zmienNazwe(s) }, 'Zmień nazwę') : null),
          h('div.slaby.maly-tekst', { style: 'margin:4px 0 10px' }, s.klasa || ''),
          h('table.tabela',
            ladunek('Stan', h('span.' + (STAN_STATKU[s.stan] || 'slaby'), s.stan || 'sprawny')),
            ladunek('Położenie', nazwaPlanety(s.lokalizacja)),
            ladunek('Ładowność', `${s.ladownosc} t`),
            ladunek('Kapitan', kapitan ? kapitan.imie : '—'),
            ladunek('Załoga', `${zalogaNa(s.id).length} os.`)));
      }));
    }

    function zmienNazwe(s) {
      const pole = h('input', { value: s.nazwa, maxlength: 60 });
      wyczysc(komunikat).append(h('div.panel', { style: 'border-color:var(--akcent);margin-bottom:14px' },
        h('div.pole', h('label', 'Nowa nazwa statku'), pole),
        h('div.rzad',
          h('button.przycisk.maly', { onclick: () => wykonaj('statek_nazwa', { statek: s.id, nazwa: pole.value }, 'Zmieniono nazwę w rejestrze statków.') }, 'Zatwierdź'),
          h('button.przycisk.drugi.maly', { onclick: () => wyczysc(komunikat) }, 'Anuluj'))));
      pole.focus();
    }

    // ---------- magazyn ----------

    function magazyn() {
      if (!dane.magazyn.length) return h('div.panel', h('div.pusto', 'Magazyny są puste.'));
      const wg = {};
      for (const m of dane.magazyn) (wg[m.planeta] ||= []).push(m);
      return h('div', Object.entries(wg)
        .sort(([a], [b]) => nazwaPlanety(a).localeCompare(nazwaPlanety(b)))
        .map(([pid, pozycje]) => {
          const masa = pozycje.reduce((s, m) => s + m.ilosc * (towary[m.towar]?.masa || 1), 0);
          return h('div.panel',
            h('div.rzad', h('h2.rozpycha', { style: 'margin:0' }, nazwaPlanety(pid)), h('span.slaby.maly-tekst', `razem ${masa} t`)),
            h('table.tabela', { style: 'margin-top:8px' },
              h('thead', h('tr', h('th', 'Towar'), h('th', 'Kategoria'), h('th', 'Ilość'), h('th', 'Masa'))),
              h('tbody', pozycje.map((m) => {
                const t = towary[m.towar] || { nazwa: '?', jednostka: '' };
                return h('tr', h('td', t.nazwa), h('td.slaby', t.kategoria || '—'), h('td', `${m.ilosc} ${t.jednostka}`), h('td.slaby', `${m.ilosc * (t.masa || 1)} t`));
              }))));
        }));
    }

    // ---------- załoga ----------

    function zaloga() {
      if (!dane.zaloga.length) return h('div.panel', h('div.pusto', 'Firma nikogo nie zatrudnia.'));
      const wybor = (z) => {
        const s = h('select', { style: 'min-height:36px;background:transparent;border:1px solid var(--linia);border-radius:4px;padding:0 6px' },
          h('option', { value: '' }, 'Baza (bez przydziału)'),
          dane.flota.map((st) => h('option', { value: st.id, selected: st.id === z.statek }, st.nazwa)));
        s.addEventListener('change', () => wykonaj('przydziel', { czlonek: z.id, statek: s.value }, `${z.imie}: nowy przydział.`));
        return s;
      };
      const czyKapitan = (z) => dane.flota.some((s) => s.kapitan === z.id);
      return h('div.panel', h('table.tabela',
        h('thead', h('tr', h('th', 'Imię'), h('th', 'Funkcja'), h('th', 'Pensja'), h('th', 'Przydział'), h('th', ''))),
        h('tbody', dane.zaloga.map((z) => h('tr',
          h('td', z.imie, czyKapitan(z) ? h('span.poziom', '  KAPITAN') : null),
          h('td.slaby', z.funkcja || '—'),
          h('td.slaby', z.pensja ? `${z.pensja} kr` : '—'),
          h('td', f.moze ? wybor(z) : (dane.flota.find((s) => s.id === z.statek)?.nazwa || 'Baza')),
          h('td', f.moze && z.statek && !czyKapitan(z)
            ? h('button.przycisk.drugi.maly', { onclick: () => wykonaj('przydziel', { czlonek: z.id, statek: z.statek, kapitan: true }, `${z.imie} dowodzi statkiem.`) }, 'Na kapitana')
            : null))))));
    }

    // ---------- szlaki ----------

    function szlaki() {
      const lista = [...dane.szlaki].sort((a, b) => (b.zmieniono || '').localeCompare(a.zmieniono || ''));
      const statek = (id) => dane.flota.find((s) => s.id === id)?.nazwa || '?';
      return h('div',
        f.moze ? h('div', { style: 'margin-bottom:14px' }, h('button.przycisk', { onclick: () => { edytor = nowyKurs(); rysuj(); } }, 'Zaplanuj kurs')) : null,
        lista.length
          ? h('div.panel', h('ul.lista', lista.map((s) => {
            const [opis, klasa] = STATUS_KURSU[s.status] || [s.status, ''];
            return h('li', h('div.rzad',
              h('div.rozpycha',
                h('div', s.nazwa),
                h('div.slaby.maly-tekst', `${statek(s.statek)} · ${s.przystanki.map((p) => nazwaPlanety(p.planeta)).join(' → ')}`),
                s.uwagi ? h('div.maly-tekst', { style: 'color:var(--akcent-2)' }, 'Kontrola ruchu: ' + s.uwagi) : null),
              h('span.maly-tekst' + (klasa ? '.' + klasa : ''), opis),
              h('button.przycisk.drugi.maly', { onclick: () => { edytor = JSON.parse(JSON.stringify(s)); rysuj(); } },
                f.moze && ['szkic', 'odrzucony'].includes(s.status) ? 'Edytuj' : 'Podgląd')));
          })))
          : h('div.panel', h('div.pusto', 'Brak zaplanowanych kursów.')));
    }

    function nowyKurs() {
      const s = dane.flota.find((x) => x.stan === 'sprawny') || dane.flota[0];
      return {
        id: '', nazwa: '', statek: s?.id || '', notatka: '', status: 'szkic',
        przystanki: [{ planeta: s?.lokalizacja || '', operacje: [] }, { planeta: '', operacje: [] }],
      };
    }

    // Edytor planu kursu: statek, przystanki, a na każdym rozładunek / załadunek.
    function edytorKursu() {
      const k = edytor;
      const edytowalny = f.moze && ['szkic', 'odrzucony'].includes(k.status);
      const problemy = h('div');
      const podsumowanie = h('div');
      const wyb = (opcje, wartosc, zmiana, pusta = null) => {
        const s = h('select', { disabled: !edytowalny, style: 'min-height:40px;background:rgba(0,0,0,.35);border:1px solid var(--linia);border-radius:4px;padding:0 8px' },
          pusta ? h('option', { value: '' }, pusta) : null,
          opcje.map(([v, n]) => h('option', { value: v, selected: v === wartosc }, n)));
        s.addEventListener('change', () => zmiana(s.value));
        return s;
      };
      const opcjePlanet = f.katalog.planety.map((p) => [p.id, p.nazwa]);
      const opcjeTowarow = f.katalog.towary.map((t) => [t.id, `${t.nazwa} (${t.masa} t/${t.jednostka})`]);

      const sprawdz = () => {
        przeliczLadunek();
        clearTimeout(licznikSprawdzania);
        licznikSprawdzania = setTimeout(async () => {
          try {
            const { problemy: p } = await f.sprawdzSzlak(k);
            wyczysc(problemy).append(p.length
              ? h('div.komunikat.blad', h('div', 'Kontrola planu:'), h('ul', { style: 'margin:6px 0 0;padding-left:18px' }, p.map((x) => h('li', x))))
              : h('div.komunikat.ok', 'Plan kursu poprawny.'));
          } catch (e) {
            wyczysc(problemy).append(h('div.komunikat.blad', e.message));
          }
        }, 350);
      };
      const przebuduj = () => { wyczysc(tresc).append(edytorKursu()); };

      // Ładunek po każdym przystanku (podgląd; ostateczne sprawdzenie robi serwer).
      function przeliczLadunek() {
        const statek = dane.flota.find((s) => s.id === k.statek);
        const ladownia = {};
        const wiersze = k.przystanki.map((p, i) => {
          for (const typ of ['rozladunek', 'zaladunek']) {
            for (const o of p.operacje.filter((x) => x.typ === typ)) {
              ladownia[o.towar] = Math.max(0, (ladownia[o.towar] || 0) + (typ === 'rozladunek' ? -o.ilosc : o.ilosc));
            }
          }
          const masa = Object.entries(ladownia).reduce((s, [t, il]) => s + il * (towary[t]?.masa || 1), 0);
          const za = statek && masa > statek.ladownosc;
          return h('tr', h('td', `${i + 1}. ${nazwaPlanety(p.planeta)}`), h('td' + (za ? '.status-nieobecny' : ''), `${masa} / ${statek?.ladownosc ?? '?'} t`));
        });
        wyczysc(podsumowanie).append(h('table.tabela', h('thead', h('tr', h('th', 'Po przystanku'), h('th', 'Ładownia'))), h('tbody', wiersze)));
      }

      const przystanek = (p, i) => h('div.panel',
        h('div.rzad',
          h('h2.rozpycha', { style: 'margin:0' }, `Przystanek ${i + 1}`),
          wyb(opcjePlanet, p.planeta, (v) => { p.planeta = v; sprawdz(); }, 'wybierz planetę'),
          edytowalny && k.przystanki.length > 2
            ? h('button.przycisk.zly.maly', { 'aria-label': 'Usuń przystanek', onclick: () => { k.przystanki.splice(i, 1); przebuduj(); sprawdz(); } }, '×') : null),
        h('div', { style: 'margin-top:10px' }, p.operacje.map((o, j) => {
          const ilosc = h('input', { type: 'number', min: 1, step: 1, value: o.ilosc || '', disabled: !edytowalny,
            style: 'width:110px;min-height:40px;background:rgba(0,0,0,.35);border:1px solid var(--linia);border-radius:4px;padding:0 8px' });
          ilosc.addEventListener('input', () => { o.ilosc = Math.max(0, Math.floor(Number(ilosc.value) || 0)); sprawdz(); });
          return h('div.rzad', { style: 'margin-bottom:8px' },
            wyb([['rozladunek', 'Rozładuj'], ['zaladunek', 'Załaduj']], o.typ, (v) => { o.typ = v; sprawdz(); }),
            wyb(opcjeTowarow, o.towar, (v) => { o.towar = v; sprawdz(); }, 'towar'),
            ilosc,
            edytowalny ? h('button.przycisk.drugi.maly', { 'aria-label': 'Usuń operację', onclick: () => { p.operacje.splice(j, 1); przebuduj(); sprawdz(); } }, '×') : null);
        })),
        edytowalny ? h('button.przycisk.drugi.maly', { onclick: () => { p.operacje.push({ typ: i === 0 ? 'zaladunek' : 'rozladunek', towar: '', ilosc: 0 }); przebuduj(); sprawdz(); } }, '+ Operacja') : null);

      const nazwa = h('input', { value: k.nazwa, maxlength: 80, disabled: !edytowalny, placeholder: 'np. Kurs zbożowy na Tatooine' });
      nazwa.addEventListener('input', () => { k.nazwa = nazwa.value; });
      const notatka = h('input', { value: k.notatka || '', maxlength: 500, disabled: !edytowalny });
      notatka.addEventListener('input', () => { k.notatka = notatka.value; });
      const opcjeStatkow = dane.flota.map((s) => [s.id, `${s.nazwa} · ${s.ladownosc} t · ${nazwaPlanety(s.lokalizacja)} · ${s.stan}`]);

      const zapisz = async (op) => {
        const wynik = await wykonaj(op, { szlak: k }, op === 'szlak_zglos' ? 'Plan lotu złożony w kontroli ruchu.' : 'Szkic zapisany.');
        if (wynik && op === 'szlak_zglos') { edytor = null; rysuj(); }
        else if (wynik) { k.id = wynik.id; rysuj(); }
      };

      const widok = h('div',
        h('div.panel',
          h('h2', k.id ? 'Plan kursu' : 'Nowy plan kursu'),
          k.uwagi ? h('div.komunikat.blad', 'Kontrola ruchu: ' + k.uwagi) : null,
          h('div.pole', h('label', 'Nazwa kursu'), nazwa),
          h('div.pole', h('label', 'Statek'), wyb(opcjeStatkow, k.statek, (v) => {
            k.statek = v;
            const s = dane.flota.find((x) => x.id === v);
            if (s?.lokalizacja && edytowalny) k.przystanki[0].planeta = s.lokalizacja;
            przebuduj(); sprawdz();
          }, 'wybierz statek')),
          h('div.pole', h('label', 'Uwagi dla kontroli ruchu'), notatka)),
        k.przystanki.map(przystanek),
        edytowalny ? h('div', { style: 'margin:14px 0' }, h('button.przycisk.drugi', { onclick: () => { k.przystanki.push({ planeta: '', operacje: [] }); przebuduj(); sprawdz(); } }, '+ Przystanek')) : null,
        h('div.panel', h('h2', 'Obciążenie ładowni'), podsumowanie, problemy),
        edytowalny ? h('div.rzad', { style: 'margin-top:14px' },
          h('button.przycisk', { onclick: () => zapisz('szlak_zglos') }, 'Złóż plan lotu'),
          h('button.przycisk.drugi', { onclick: () => zapisz('szlak_zapisz') }, 'Zapisz szkic'),
          k.id ? h('button.przycisk.zly', { onclick: async () => { if (await wykonaj('szlak_usun', { id: k.id }, 'Plan usunięty.')) { edytor = null; rysuj(); } } }, 'Usuń') : null) : null,
      );
      sprawdz();
      return widok;
    }

    rysuj();
    return () => clearTimeout(licznikSprawdzania);
  },
};
