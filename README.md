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
api/bank.php             logika banku (przelewy, odbiorcy, stałe dochody)
api/firmy.php            firmy (profile), przewozy i wspólny katalog towarów i planet
api/komorka.php          profil komórki: misje
api/agencja.php          profil agencji (ISB): wypłaty dla agentów, teczki i meldunki
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
| Firma | panel zależny od profilu: przewozy, komórka (plus misje), agencja handlowa (przykrywka ISB) | nowe |
| Bank | saldo i historia, przelewy na numer rachunku (z potwierdzeniem właściciela), stali odbiorcy | nowe |
| Dekoder | odbiór dokumentu po sygnaturze, poziomy uprawnień, katalogi, animacja dekodowania | `/dekoder/gracz/` |
| Harmonogram | kalendarz miesięczny, deklaracje obecności postaci (jedna na dzień) | `/calendar/` |
| Sieć frakcji | planety i instalacje, zasoby (gracze zmieniają stany), drzewo dowodzenia | `/frakcja/gracz/` |
| Ustawienia | alfabet (moduł ZPH), jasność, dane postaci, „o urządzeniu”, blokada | nowe |

Nowa aplikacja to plik w `js/aplikacje/`, który eksportuje
`{ id, nazwa, ikona, uruchom(kontener, ctx) }`. Trzeba go jeszcze dopisać do listy `APLIKACJE`
w `js/system.js` i do `PLIKI` w `sw.js`. Wzorem może być `ustawienia.js`, najprostsza z aplikacji.

## Bank

- Każda postać dostaje rachunek (numer `0000-0000-0000`) przy pierwszym wejściu do banku.
  Waluta to kredyty (`kr`), tylko liczby całkowite.
- Przelew idzie na numer rachunku. Po wpisaniu numeru bank pokazuje właściciela, a przed
  wysłaniem jest ekran potwierdzenia. Nie da się przelać więcej, niż jest na koncie.
- Stałych odbiorców zapisuje się z własną nazwą (np. „Mechanik z doków”), także przy przelewie.
- **MG** (zakładka Bank) widzi salda i wszystkie operacje. Może zaksięgować jednorazową wpłatę
  lub obciążenie i ustawia **stałe miesięczne dochody**: postać, kwota, dzień miesiąca (1–28),
  nadawca i tytuł. Kwota ujemna działa jak stała opłata (np. czynsz za hangar) i może zejść
  z saldem poniżej zera.
- Dochody wypłacają się bez crona: przy każdym wejściu do banku system dopisuje wszystkie
  wypłaty, których termin minął (z datą należnego dnia). Strefa czasowa: Europe/Warsaw.
- Cały bank to jeden plik danych zmieniany pod blokadą, więc przelew wykonuje się w całości
  albo wcale.

## Firmy

- **Wspólny katalog** (panel MG → Katalog): towary (nazwa, kategoria, masa w t na jednostkę,
  jednostka) i planety. Tę samą listę towarów użyje giełda. Do planet dojdzie później mapa
  (współrzędne, odległości).
- Firma ma **profil**, który decyduje o interfejsie. Profil to para plików:
  `js/aplikacje/firma/<profil>.js` (zakładki) i logika w `api/firmy.php` (dane i operacje).
  Nowy profil: dopisać go do `PROFILE` w `js/aplikacje/firma.js`, `PROFILE_FIRM` w `api/firmy.php`
  (razem z `firma_dane_puste` i operacjami) oraz `PROFILE_FIRM` w `gm/mg.js`.
- Członkowie firmy: **właściciel** i **menedżer** mogą zmieniać dane, **pracownik** tylko podgląda.
  Postać należąca do jednej firmy trafia od razu do jej panelu.

### Wspólne dla wszystkich profili

- **Rachunek firmy** w banku (klucz `f:<id firmy>`): zakładka Finanse pokazuje saldo, numer
  i historię. Właściciel i menedżer robią z niego przelewy. Na rachunek firmy można przelać
  pieniądze zwykłym przelewem z aplikacji Bank, a MG może go zasilić (Bank → operacja
  jednorazowa) albo ustawić mu stały miesięczny dochód.
- **Budynki i rynek nieruchomości:** MG wystawia oferty (Katalog → Rynek nieruchomości),
  firma kupuje je z własnego rachunku, a kupiona oferta znika z rynku. Budynek ma pojemność,
  liczbę pracowników (gracz zatrudnia i zwalnia) i kierownika z załogi.
- **Ukryte statystyki** osób (1–10): pilotaż, dowodzenie, taktyka, zarządzanie, logistyka,
  lojalność, konspiracja. Nigdy nie trafiają do datapada. **Test** daje zgrubną ocenę słowną
  (prawdziwa wartość ±2) i można go powtórzyć **raz na 30 dni** dla tej samej osoby.
- **Pula kandydatów** (panel MG → Rekrutacja): osoby do zatrudnienia z ukrytymi statystykami.
  Firma może je testować (każda firma osobno, raz w miesiącu) i zatrudnić. Zatrudniony znika
  z puli i przechodzi do załogi razem z wynikiem testu. Pule: `ogolna` (przewozy i komórki)
  i `agencja` (agencja handlowa).

### Profil: przewozy

- **Flota:** statki z ładownością (t), stanem, położeniem i kapitanem. Gracz może zmienić nazwę.
- **Magazyn:** towar firmy na poszczególnych planetach.
- **Załoga:** gracz przydziela ludzi do statków i wyznacza kapitana.
- **Szlaki:** plan kursu, czyli statek i przystanki, a na każdym rozładunek lub załadunek.
  Serwer na bieżąco sprawdza plan: start tam, gdzie stoi statek, ładowność po każdym przystanku,
  rozładunek tylko tego, co jest na pokładzie, załadunek tylko tego, co jest w magazynie, i pustą
  ładownię na końcu.
- Gracz składa **plan lotu**, a MG (panel → Firmy → „Kursy do obsłużenia”) przyjmuje go
  („w trasie”), kończy albo odrzuca z uwagą. Zakończenie przenosi towar między magazynami
  i stawia statek na ostatniej planecie. Przy przyjęciu i zakończeniu plan jest sprawdzany
  ponownie, na aktualnych magazynach.
- MG ustawia flotę, załogę i magazyn w edytorze JSON. Planety, towary, statki i osoby wpisuje
  po nazwie. Zapis w edytorze nie rusza kursów graczy.
- Pensje i koszt obsady budynków są na razie tylko informacją (nic nie schodzi automatycznie
  z rachunku), a kurs nie kosztuje paliwa. To naturalne następne kroki razem z giełdą i mapą.

### Profil: komórka

To ten sam panel co w przewozach (flota, magazyn, załoga, legalne kursy handlowe), plus
dodatki (`js/aplikacje/firma/komorka.js`, `api/komorka.php`):

- **Misje:** gracz wysyła statki i ludzi na akcję z kryptonimem, terminem, rejonem i celem.
  **Jedna misja to jedna sesja z MG.** MG ją zatwierdza (siły dostają stan „na misji” i są
  zablokowane dla kursów i innych misji), a po sesji **rozlicza ręcznie**:
  - dla każdego statku: wrócił sprawny, uszkodzony albo zniszczony (zniszczony znika z floty);
  - dla każdej osoby: cała, ranna albo poległa (poległa znika z załogi);
  - zmiany w magazynach (łup na plus, straty na minus);
  - gdzie statki kończą misję;
  - raport, który gracze czytają w zakładce Misje.
- Ranna osoba nie poleci na misję. Wyleczenie: MG zmienia jej `stan` na `zdrowy` w edytorze.

### Profil: agencja handlowa (przykrywka ISB)

Wewnętrzne narzędzie ISB do kontaktu, kontroli i rozliczeń z nielegałami i szpiegami.
W datapadzie wygląda jak zwykła agencja handlowa i nigdzie nie pada słowo „ISB”. Nazwę firmy
wybiera MG (np. „Biuro Analiz Rynkowych Sektora”). Zakładki:

- **Kontrahenci:** agenci z kryptonimami i ukrytymi statystykami (test jak u kapitanów
  i kierowników) oraz kandydaci do współpracy z puli `agencja`. Przycisk **Rozlicz** wypłaca
  pieniądze z rachunku agencji. Jeśli agent jest postacią gracza (pole `gracz` w edytorze MG),
  przelew trafia na jego rachunek z neutralnym tytułem, np. „Prowizja handlowa”. W przeciwnym
  razie jest to wypłata gotówkowa.
- **Statki:** flota agentów.
- **Kontrakty:** misje handlowe. To misje z komórki z dodatkowymi **warunkami oficjalnymi**
  (legendą: ładunek, trasa, odbiorca) i **uwagami poufnymi** (prawdziwe zadanie). MG zatwierdza
  je i rozlicza ręcznie, z dodatkowymi wynikami: agent **spalony** albo **zatrzymany**, statek
  **przejęty**.
- **Monitoring:** teczki obserwowanych obiektów (osoby, statki, lokale). MG dopisuje do nich
  meldunki z terenu (panel MG → Firmy → Teczki w obserwacji).
- **Rozliczenia:** rachunek agencji (to samo co Finanse w innych profilach).

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
