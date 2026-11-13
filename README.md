# HOLOLINK — datapad dla b0r5.pl

System operacyjny taniego prywatnego datapada ze świata Gwiezdnych Wojen, z dostępem do holonetu.
Działa w przeglądarce na tabletach, w trybie pełnoekranowym. Zastępuje dawne osobne moduły
(hub, kalendarz, dekoder, portal frakcji) jednym spójnym systemem.

Projekt stoi w korzeniu domeny **b0r5.pl**. Foldery `/_/` i `/__/` na serwerze to **inny projekt**
(repo `b0r5.pl`). Przy wgrywaniu nie wolno ich ruszać.

## Zasady immersji (najważniejsze)

1. **Zero informacji spoza gry w datapadzie.** Żadnych numerów wersji strony, nazw systemów RPG,
   „MG”, „Google”, „zaloguj się przez…”, linków do Facebooka itp. Wszystko, łącznie z komunikatami
   błędów, mówi językiem świata („Węzeł holonetu nie odpowiada”, a nie „Błąd 500”).
2. **Fabuła alfabetu:** fabryczny system mówi tylko w Aurebeshu. Hakerzy z Zephyrii wgrali
   nieautoryzowany moduł **ZPH**, który przepisuje wszystko na alfabet łaciński. Stąd różowe
   (`--zph`) elementy: przełącznik na pasku, wpisy w rozruchu, sekcja w Ustawieniach.
3. **Przełączanie jest pełne:** zmiana alfabetu przełącza krój pisma całego ekranu, także pól
   formularzy i treści dokumentów. Tekst w kodzie zawsze piszemy po polsku, alfabetem łacińskim.
   Aurebesh to tylko czcionka.
4. **Wszystko, co meta, idzie do panelu MG** (`/gm/`), który jest poza światem gry.

## Struktura

```
index.html               powłoka datapada (jedna strona)
manifest.webmanifest     instalacja na tablecie, pełny ekran, poziomo
sw.js                    pliki systemu w pamięci tabletu (działa przy słabym zasięgu)
css/system.css           cały wygląd, kolory w zmiennych na :root
js/system.js             start → rozruch → blokada → pulpit, menedżer aplikacji, alfabet
js/rdzen/narzedzia.js    h() do budowania elementów, czas GST, pamięć urządzenia
js/rdzen/api.js          łączność z api/ (błędy w języku świata)
js/rdzen/urzadzenie.js   producent, model i nazwa systemu (zmieniajcie tutaj)
js/aplikacje/*.js        aplikacje: holonet, dekoder, harmonogram, frakcja, ustawienia
api/index.php            jedno API dla wszystkiego (PHP 8.1+, dane w plikach)
api/dane/                dane gry, tylko na serwerze (poza gitem)
gm/                      panel MG: konta, dokumenty, holonet, frakcje, harmonogram
assets/czcionki/         czcionka Aurebesh
narzedzia/czcionka/      generator czcionki Aurebesh
```

Bez frameworków i bez budowania. Pliki trafiają na serwer w takiej postaci, w jakiej są w repo.

## Aplikacje

| Aplikacja | Co robi | Skąd się wzięła |
|---|---|---|
| Holonet | komunikaty sieci (pisze je MG), transmisja na żywo, przechwycony kanał B0R5 | hub, stream, `/recruitment/` |
| Dekoder | odbiór dokumentu po sygnaturze, poziomy uprawnień, katalogi, animacja dekodowania | `/dekoder/gracz/` |
| Harmonogram | kalendarz miesięczny, deklaracje obecności postaci (jedna na dzień) | `/calendar/` |
| Sieć frakcji | planety i instalacje, zasoby (gracze zmieniają stany), drzewo dowodzenia | `/frakcja/gracz/` |
| Ustawienia | alfabet (moduł ZPH), jasność, dane postaci, „o urządzeniu”, blokada | nowe |

Nowa aplikacja to plik w `js/aplikacje/`, który eksportuje
`{ id, nazwa, ikona, uruchom(kontener, ctx) }`. Trzeba go jeszcze dopisać do listy `APLIKACJE`
w `js/system.js` i do `PLIKI` w `sw.js`. Wzorem może być `ustawienia.js`, najprostsza z aplikacji.

## Konta i bezpieczeństwo

- **Jedno konto** (identyfikator i klucz) działa w całym datapadzie. Zamiast trzech różnych
  logowań jest jedno.
- Hasła są przechowywane tylko jako hash (`password_hash`). MG nie widzi haseł, może je tylko
  ustawić na nowe.
- Każdy plik w `api/dane/` zaczyna się od linii PHP, która zwraca 404, więc danych nie da się
  pobrać z sieci nawet bez `.htaccess`.
- Zapisy (harmonogram, zasoby, dekoder) wymagają zalogowania. Każde żądanie POST musi mieć
  nagłówek `X-Datapad: 1`, co chroni przed formularzami wysyłanymi z obcych stron.
- Dokument może wymagać poziomu uprawnień (1–9) i przynależności do frakcji.

## Uruchomienie lokalnie

```bash
php -S 127.0.0.1:8080
# datapad: http://127.0.0.1:8080/     panel MG: http://127.0.0.1:8080/gm/
```

Przy pierwszym wejściu panel MG pozwala założyć konto MG. W panelu MG zakłada się konta graczy.

## Wdrożenie na b0r5.pl

1. Wgrać zawartość repo do korzenia domeny, **bez ruszania `/_/` i `/__/`**.
2. Upewnić się, że PHP na serwerze ma wersję co najmniej 8.1 i może zapisywać w `api/dane/`.
3. Wejść na `/gm/`, założyć konto MG, potem konta graczy.
4. Na tabletach: Chrome → „Dodaj do ekranu głównego”. Uruchomiony z ikony datapad działa na
   pełnym ekranie, bez paska przeglądarki.
5. Po zmianie plików systemu podbić `WERSJA` w `sw.js`, żeby tablety pobrały nowe pliki.

Stare adresy (`/calendar/`, `/frakcja/`, `/dekoder/`, `/recruitment/`) przestaną być potrzebne.
Warto ustawić przekierowania na `/`.

## Czcionka Aurebesh

`assets/czcionki/aurebesh.otf` jest generowana z kształtów zapisanych w
`narzedzia/czcionka/generuj.js` (`npm install && node generuj.js`). **Kształty są przybliżeniem
Aurebesha i trzeba je sprawdzić z tablicą znaków.** Można też po prostu podmienić plik na inną
czcionkę Aurebesh (z odpowiednią licencją), pod tą samą nazwą. Polskie litery z ogonkami
dostają kształt litery podstawowej.

## Do decyzji

- **CDEX** (`b0r5.beep.pl`, po HTTP): nie trafił do datapada. Ramka po HTTP na stronie HTTPS
  jest blokowana przez przeglądarkę.
- **LARP** (`/larp/`, zapisy na wydarzenie): to strona dla prawdziwych ludzi (dane kontaktowe,
  terminy), więc nie pasuje do datapada. Może zostać osobno albo zniknąć, bo termin minął.
- **Transmisja na żywo** pokazuje odtwarzacz Twitcha z jego logo. To mały wyłom w immersji.
- **Logowanie Google** dla MG zostało zastąpione zwykłym kontem z rolą MG.
- **DataPad (OLD/NEW)**: nie było jak zajrzeć do jego zawartości, więc nie został przeniesiony.
