// Profil: komórka (np. komórka Rebelii). Panel jak w firmie przewozowej (flota, magazyn,
// załoga, legalne kursy handlowe) plus Budynki i Misje.

import transport from './transport.js';

const STATUS_MISJI = {
  szkic: ['Szkic', ''],
  zgloszona: ['Czeka na zatwierdzenie dowództwa', 'status-niepewny'],
  zatwierdzona: ['Zatwierdzona · siły w gotowości', 'status-dostepny'],
  rozliczona: ['Zakończona', 'slaby'],
  odrzucona: ['Odrzucona', 'status-nieobecny'],
};

const WYNIK = {
  sprawny: 'wrócił sprawny', uszkodzony: 'uszkodzony', zniszczony: 'zniszczony',
  zdrowy: 'cały i zdrowy', ranny: 'ranny', zginal: 'poległ',
};

export default {
  nazwa: 'Komórka',

  uruchom(obszar, f) {
    return transport.uruchom(obszar, f, {
      nazwyZakladek: [['budynki', 'Budynki'], ['misje', 'Misje']],
      zakladki: { budynki, misje },
    });
  },
};

// ---------- budynki ----------

function budynki(p) {
  const { h, dane, f } = p;
  if (!dane.budynki.length) return h('div.panel', h('div.pusto', 'Komórka nie dysponuje budynkami.'));
  return h('div.karty', dane.budynki.map((b) => {
    const kier = dane.zaloga.find((z) => z.id === b.menedzer);
    const zmien = (o) => p.wykonaj('budynek_pracownicy', { budynek: b.id, pracownicy: b.pracownicy + o });
    const wiersz = (k, v) => h('tr', h('th', k), h('td', v));
    return h('div.panel',
      h('h2', { style: 'margin:0' }, b.nazwa),
      h('div.slaby.maly-tekst', { style: 'margin:4px 0 10px' }, [b.typ, p.nazwaPlanety(b.planeta)].filter((x) => x && x !== '—').join(' · ')),
      h('table.tabela',
        wiersz('Kierownik', kier ? kier.imie : h('span.status-nieobecny', 'brak')),
        wiersz('Pracownicy', f.moze
          ? h('span.licznik',
            h('button', { onclick: () => zmien(-1), disabled: b.pracownicy <= 0, 'aria-label': 'Zwolnij' }, '−'),
            h('span', `${b.pracownicy} / ${b.pojemnosc}`),
            h('button', { onclick: () => zmien(1), disabled: b.pracownicy >= b.pojemnosc, 'aria-label': 'Zatrudnij' }, '+'))
          : `${b.pracownicy} / ${b.pojemnosc}`),
        b.pensja ? wiersz('Koszt obsady', `${b.pracownicy * b.pensja} kr / mies.`) : null),
      b.opis ? h('p.slaby.maly-tekst', b.opis) : null,
      !kier && f.moze ? h('p.slaby.maly-tekst', 'Kierownika wyznaczysz w zakładce Załoga: przydziel osobę do budynku i wybierz „Na kierownika”.') : null);
  }));
}

// ---------- misje ----------

function misje(p) {
  const { h, dane, f } = p;
  const lista = [...dane.misje].sort((a, b) => (b.zmieniono || '').localeCompare(a.zmieniono || ''));
  return h('div',
    f.moze ? h('div', { style: 'margin-bottom:14px' }, h('button.przycisk', { onclick: () => { const m = nowaMisja(); p.otworz(() => edytorMisji(p, m)); } }, 'Nowa misja')) : null,
    lista.length
      ? h('div.panel', h('ul.lista', lista.map((m) => {
        const [opis, klasa] = STATUS_MISJI[m.status] || [m.status, ''];
        const edytowalna = f.moze && ['szkic', 'odrzucona'].includes(m.status);
        return h('li', h('div.rzad',
          h('div.rozpycha',
            h('div', m.nazwa),
            h('div.slaby.maly-tekst', [m.termin && new Date(m.termin).toLocaleDateString('pl-PL'), p.nazwaPlanety(m.planeta), `${m.statki.length} stat. · ${m.zaloga.length} os.`].filter((x) => x && x !== '—').join(' · ')),
            m.uwagi ? h('div.maly-tekst', { style: 'color:var(--akcent-2)' }, 'Dowództwo: ' + m.uwagi) : null),
          h('span.maly-tekst' + (klasa ? '.' + klasa : ''), opis),
          h('button.przycisk.drugi.maly', {
            onclick: () => {
              const kopia = JSON.parse(JSON.stringify(m));
              p.otworz(() => (m.status === 'rozliczona' ? raport(p, kopia) : edytorMisji(p, kopia)));
            },
          }, m.status === 'rozliczona' ? 'Raport' : edytowalna ? 'Edytuj' : 'Podgląd')));
      })))
      : h('div.panel', h('div.pusto', 'Brak misji.')));
}

function nowaMisja() {
  const jutro = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return { id: '', nazwa: '', cel: '', planeta: '', termin: jutro, statki: [], zaloga: [], status: 'szkic' };
}

function edytorMisji(p, m) {
  const { h, dane, f } = p;
  const edytowalna = f.moze && ['szkic', 'odrzucona'].includes(m.status);
  const problemy = h('div');
  const pole = (etykieta, el) => h('div.pole', h('label', etykieta), el);

  const nazwa = h('input', { value: m.nazwa, maxlength: 80, disabled: !edytowalna, placeholder: 'np. Operacja Cichy Świt' });
  nazwa.addEventListener('input', () => { m.nazwa = nazwa.value; });
  const termin = h('input', { type: 'date', value: m.termin, disabled: !edytowalna });
  termin.addEventListener('input', () => { m.termin = termin.value; });
  const cel = h('textarea', { maxlength: 2000, disabled: !edytowalna, placeholder: 'Cel, plan działania, czego potrzebujecie od dowództwa' }, m.cel);
  cel.addEventListener('input', () => { m.cel = cel.value; });
  const planeta = h('select', { disabled: !edytowalna },
    h('option', { value: '' }, 'nie dotyczy / tajne'),
    p.f.katalog.planety.map((x) => h('option', { value: x.id, selected: x.id === m.planeta }, x.nazwa)));
  planeta.addEventListener('change', () => { m.planeta = planeta.value; });

  // Wybór sił: pola wyboru przy statkach i ludziach.
  const wybor = (lista, klucz, opis) => h('div', lista.map((x) => {
    const pole2 = h('input', { type: 'checkbox', checked: m[klucz].includes(x.id), disabled: !edytowalna });
    pole2.addEventListener('change', () => {
      m[klucz] = pole2.checked ? [...m[klucz], x.id] : m[klucz].filter((i) => i !== x.id);
    });
    return h('label.rzad', { style: 'min-height:40px;cursor:pointer' }, pole2, h('span', opis(x)));
  }));
  const statki = wybor(dane.flota, 'statki', (s) => `${s.nazwa} · ${s.klasa || ''} · ${p.nazwaPlanety(s.lokalizacja)} · ${s.stan}`);
  const ludzie = wybor(dane.zaloga, 'zaloga', (z) => `${z.imie} · ${z.funkcja || ''}${z.stan && z.stan !== 'zdrowy' ? ' · ' + z.stan : ''}`);

  const pokazProblemy = (tytul, lista) => p.wyczysc(problemy).append(h('div.komunikat.blad', h('div', tytul),
    lista?.length ? h('ul', { style: 'margin:6px 0 0;padding-left:18px' }, lista.map((x) => h('li', x))) : null));

  const wyslij = async (op) => {
    p.wyczysc(problemy);
    let w;
    try {
      w = await f.operacja(op, { misja: m });
    } catch (e) {
      pokazProblemy(e.message, e.problemy);
      return;
    }
    m.id = w.id;
    await p.odswiez();
    if (op === 'misja_zglos') {
      p.zamknij();
      p.pokaz('Rozkaz misji przekazany dowództwu.', 'ok');
    } else {
      p.pokaz('Szkic zapisany.', 'ok');
    }
  };

  return h('div',
    h('div.panel',
      h('h2', m.id ? 'Rozkaz misji' : 'Nowa misja'),
      m.uwagi ? h('div.komunikat.blad', 'Dowództwo: ' + m.uwagi) : null,
      pole('Kryptonim', nazwa),
      h('div.dwie-kolumny', { style: 'grid-template-columns:1fr 1fr' }, pole('Termin akcji', termin), pole('Rejon działań', planeta)),
      pole('Cel i plan', cel)),
    h('div.dwie-kolumny', { style: 'grid-template-columns:1fr 1fr;margin-top:14px' },
      h('div.panel', h('h2', 'Statki'), dane.flota.length ? statki : h('div.slaby', 'Brak statków.')),
      h('div.panel', h('h2', 'Ludzie'), dane.zaloga.length ? ludzie : h('div.slaby', 'Brak ludzi.'))),
    problemy,
    edytowalna ? h('div.rzad', { style: 'margin-top:14px' },
      h('button.przycisk', { onclick: () => wyslij('misja_zglos') }, 'Przekaż rozkaz dowództwu'),
      h('button.przycisk.drugi', { onclick: () => wyslij('misja_zapisz') }, 'Zapisz szkic'),
      m.id ? h('button.przycisk.zly', { onclick: async () => { if (await p.wykonaj('misja_usun', { id: m.id }, 'Misja usunięta.')) p.zamknij(); } }, 'Usuń') : null) : null);
}

function raport(p, m) {
  const { h } = p;
  const lista = (tytul, el) => (el.length ? h('div.panel', h('h2', tytul), h('ul.lista', el)) : null);
  return h('div',
    h('div.panel',
      h('h2', `Raport: ${m.nazwa}`),
      h('div.slaby.maly-tekst', { style: 'margin-bottom:10px' }, [m.termin && new Date(m.termin).toLocaleDateString('pl-PL'), p.nazwaPlanety(m.planeta)].filter((x) => x && x !== '—').join(' · ')),
      h('div.dokument-tresc', m.raport || 'Dowództwo nie przekazało raportu.')),
    lista('Statki', (m.straty?.statki || []).map((s) => h('li', h('div.rzad', h('span.rozpycha', s.nazwa),
      h('span.' + (s.wynik === 'sprawny' ? 'status-dostepny' : s.wynik === 'uszkodzony' ? 'status-niepewny' : 'status-nieobecny'), WYNIK[s.wynik]))))),
    lista('Ludzie', (m.straty?.zaloga || []).map((z) => h('li', h('div.rzad', h('span.rozpycha', z.imie),
      h('span.' + (z.wynik === 'zdrowy' ? 'status-dostepny' : z.wynik === 'ranny' ? 'status-niepewny' : 'status-nieobecny'), WYNIK[z.wynik]))))),
    lista('Zmiany w magazynach', (m.lup || []).map((l) => h('li', h('div.rzad',
      h('span.rozpycha', `${p.towary[l.towar]?.nazwa || '?'} · ${p.nazwaPlanety(l.planeta)}`),
      h('span.' + (l.ilosc > 0 ? 'bank-plus' : 'status-nieobecny'), `${l.ilosc > 0 ? '+' : ''}${l.ilosc} ${p.towary[l.towar]?.jednostka || ''}`))))));
}
