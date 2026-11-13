// Ustawienia: alfabet (moduł ZPH), jasność, informacje o urządzeniu, blokada.

import { h, wyczysc } from '../rdzen/narzedzia.js';
import { URZADZENIE } from '../rdzen/urzadzenie.js';

export default {
  id: 'ustawienia',
  nazwa: 'Ustawienia',
  ikona: '<circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M11 37l4-4M33 15l4-4"/>',

  uruchom(w, ctx) {
    const u = ctx.uzytkownik;
    const wybor = h('div.przelacznik-duzy');

    const rysujWybor = () => {
      wyczysc(wybor).append(
        h('button.zawsze-aur' + (!ctx.alfabet.lacinski ? '.aktywna' : ''), { onclick: () => { ctx.alfabet.ustaw(false); setTimeout(rysujWybor, 200); } }, 'Aurebesh'),
        h('button.zawsze-lat' + (ctx.alfabet.lacinski ? '.aktywna' : ''), { onclick: () => { ctx.alfabet.ustaw(true); setTimeout(rysujWybor, 200); } }, 'Łaciński'),
      );
    };

    const jasnosc = h('input', { type: 'range', min: 30, max: 100, value: ctx.jasnosc() });
    jasnosc.addEventListener('input', () => ctx.jasnosc(Number(jasnosc.value)));

    const wiersz = (k, v) => h('tr', h('th', k), h('td', v));

    w.append(
      h('div.app-glowa', h('h1', 'Ustawienia')),
      h('div.panel', { style: 'border-color: var(--zph)' },
        h('h2', { style: 'color: var(--zph)' }, 'Transliteracja · moduł ZPH'),
        h('p.slaby.maly-tekst', 'Moduł spoza listy zaufanego oprogramowania. Przepisuje wszystkie znaki systemu na alfabet łaciński.'),
        wybor),
      h('div.panel',
        h('h2', 'Ekran'),
        h('div.pole', h('label', 'Jasność'), jasnosc)),
      h('div.panel',
        h('h2', 'Użytkownik'),
        h('table.tabela',
          wiersz('Postać', u.postac),
          wiersz('Przynależność', u.frakcja),
          u.oddzial ? wiersz('Oddział', u.oddzial) : null,
          u.ranga ? wiersz('Ranga', u.ranga) : null,
          wiersz('Poziom uprawnień', u.poziom)),
        h('div', { style: 'margin-top:14px' }, h('button.przycisk.zly', { onclick: () => ctx.zablokuj() }, 'Zablokuj urządzenie'))),
      h('div.panel',
        h('h2', 'O urządzeniu'),
        h('table.tabela',
          wiersz('Producent', URZADZENIE.producent),
          wiersz('Model', URZADZENIE.model),
          wiersz('System', `${URZADZENIE.system} ${URZADZENIE.wersja}`),
          wiersz('Numer seryjny', URZADZENIE.numerSeryjny()),
          wiersz('Podpis oprogramowania', h('span', { style: 'color: var(--zph)' }, 'NIEZGODNY')))),
    );
    rysujWybor();
  },
};
