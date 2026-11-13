<?php
// Firmy i wspólny katalog (towary, planety).
//
// Katalog towarów jest jeden dla całej gry: korzysta z niego firma transportowa,
// a później giełda. Planety to na razie lista nazw; mapa dołączy do nich współrzędne.
//
// Firma ma profil (na razie tylko „transport”). Profil decyduje, jakie dane firma trzyma
// i jakie operacje wolno na nich wykonywać. Interfejs profilu jest w js/aplikacje/firma/.

declare(strict_types=1);

const PROFILE_FIRM = ['transport', 'komorka', 'agencja'];

// Ukryte cechy osób (1–10). Klucz => nazwa wyświetlana. Gracz poznaje je tylko testem.
const STATYSTYKI = [
    'pilotaz' => 'Pilotaż',
    'dowodzenie' => 'Dowodzenie',
    'taktyka' => 'Taktyka',
    'zarzadzanie' => 'Zarządzanie',
    'logistyka' => 'Logistyka',
    'lojalnosc' => 'Lojalność',
    'konspiracja' => 'Konspiracja',
];
const STANY_OSOBY = ['zdrowy', 'ranny', 'na misji', 'spalony', 'zatrzymany'];
const TEST_CO_ILE_DNI = 30;
// Z której puli kandydatów rekrutuje dany profil.
const PULA_PROFILU = ['transport' => 'ogolna', 'komorka' => 'ogolna', 'agencja' => 'agencja'];
const ROLE_FIRMY = ['wlasciciel', 'menedzer', 'pracownik'];
const STANY_STATKU = ['sprawny', 'uszkodzony', 'w naprawie', 'w trasie', 'na misji'];
const STATUSY_SZLAKU = ['szkic', 'zgloszony', 'w_realizacji', 'zakonczony', 'odrzucony'];

function katalog(): array
{
    $k = wczytaj('katalog', []);
    return ['towary' => $k['towary'] ?? [], 'planety' => $k['planety'] ?? [], 'oferty' => $k['oferty'] ?? []];
}

// Test ukrytych cech: wartość ±2, opisana słownie. Najwyżej raz na TEST_CO_ILE_DNI dni.
function test_ocena(array $statystyki, ?array $poprzednia, string $tester): array
{
    if (!$statystyki) blad('Tej osoby nie da się ocenić testem.');
    $ostatni = isset($poprzednia['data']) ? strtotime($poprzednia['data']) : 0;
    $nastepny = $ostatni + TEST_CO_ILE_DNI * 86400;
    if ($ostatni && time() < $nastepny) blad('Kolejny test tej osoby będzie możliwy ' . date('d.m.Y', $nastepny) . '.');
    $wyniki = [];
    foreach ($statystyki as $k => $v) {
        $z = max(1, min(10, (int) $v + random_int(-2, 2)));
        $wyniki[STATYSTYKI[$k] ?? $k] = match (true) {
            $z <= 2 => 'bardzo słabo',
            $z <= 4 => 'słabo',
            $z <= 6 => 'przeciętnie',
            $z <= 8 => 'dobrze',
            default => 'wybitnie',
        };
    }
    return ['data' => date('c'), 'wyniki' => $wyniki, 'tester' => $tester];
}

function oczysc_statystyki($st): array
{
    $wynik = [];
    foreach ((array) $st as $klucz => $v) {
        if (isset(STATYSTYKI[$klucz])) $wynik[$klucz] = max(1, min(10, (int) $v));
    }
    return $wynik;
}

function kandydaci_puste(): array
{
    return ['lista' => []];
}

// Kandydaci z puli widoczni dla firmy: bez statystyk, z wynikiem testu tej firmy.
function kandydaci_dla_firmy(array $firma): array
{
    $pula = PULA_PROFILU[$firma['profil']] ?? 'ogolna';
    $wynik = [];
    foreach (wczytaj('kandydaci', kandydaci_puste())['lista'] as $k) {
        if (($k['pula'] ?? 'ogolna') !== $pula) continue;
        $wynik[] = [
            'id' => $k['id'], 'imie' => $k['imie'], 'funkcja' => $k['funkcja'] ?? '', 'pensja' => $k['pensja'] ?? 0,
            'opis' => $k['opis'] ?? '', 'testowalny' => !empty($k['statystyki']), 'ocena' => $k['testy'][$firma['id']] ?? null,
        ];
    }
    return $wynik;
}

// Pozycja katalogu po id albo po nazwie (bez względu na wielkość liter).
function katalog_id(array $lista, string $wartosc, string $co): string
{
    foreach ($lista as $x) {
        if ($x['id'] === $wartosc || mb_strtolower($x['nazwa']) === mb_strtolower(trim($wartosc))) {
            return $x['id'];
        }
    }
    blad("Nieznana $co: „{$wartosc}”. Dodaj ją najpierw w katalogu.");
}

function firmy_puste(): array
{
    return ['firmy' => []];
}

function firma_dane_puste(string $profil): array
{
    return match ($profil) {
        'transport' => ['flota' => [], 'zaloga' => [], 'magazyn' => [], 'szlaki' => [], 'budynki' => []],
        'komorka' => ['flota' => [], 'zaloga' => [], 'magazyn' => [], 'szlaki' => [], 'budynki' => [], 'misje' => []],
        'agencja' => ['flota' => [], 'zaloga' => [], 'magazyn' => [], 'szlaki' => [], 'budynki' => [], 'misje' => [], 'cele' => []],
    };
}

// Listy, które MG ustawia w edytorze JSON (reszta, np. kursy i misje, zmienia się tylko w grze).
function firma_edytowalne(string $profil): array
{
    return match ($profil) {
        'transport', 'komorka', 'agencja' => ['flota', 'zaloga', 'magazyn', 'budynki'],
    };
}

// Dane firmy dla datapada: bez ukrytych statystyk osób (widzi je tylko MG).
function firma_dla_gracza(array $f): array
{
    $f['dane'] += firma_dane_puste($f['profil']);
    foreach ($f['dane']['zaloga'] as &$z) {
        $z['testowalny'] = !empty($z['statystyki']);
        unset($z['statystyki']);
    }
    return $f;
}

function firma_rola(array $firma, string $uid): ?string
{
    foreach ($firma['czlonkowie'] as $c) {
        if ($c['uid'] === $uid) {
            return $c['rola'];
        }
    }
    return null;
}

function nadaj_id(array $lista): array
{
    foreach ($lista as &$x) {
        if (!is_array($x)) {
            blad('Każda pozycja listy musi być obiektem.');
        }
        if (empty($x['id'])) {
            $x['id'] = id();
        }
    }
    return $lista;
}

// ---------- transport: sprawdzanie szlaku ----------
//
// Symulujemy kurs przystanek po przystanku: najpierw rozładunek, potem załadunek.
// Sprawdzamy ładowność, to, czy rozładowujemy tylko to, co jest na pokładzie,
// i czy w magazynie na danej planecie jest dość towaru (z uwzględnieniem wcześniejszych
// rozładunków w tym samym kursie). Zwraca listę problemów; pusta = szlak poprawny.

function transport_sprawdz_szlak(array $szlak, array $dane, array $katalog, bool $w_trasie = false): array
{
    $problemy = [];
    $towary = array_column($katalog['towary'], null, 'id');
    $planety = array_column($katalog['planety'], null, 'id');
    $statki = array_column($dane['flota'], null, 'id');

    $statek = $statki[$szlak['statek'] ?? ''] ?? null;
    if (!$statek) {
        return ['Nie wybrano statku.'];
    }
    // Przy rozliczaniu trwającego kursu statek jest „w trasie” — to oczekiwane.
    if (!$w_trasie && ($statek['stan'] ?? 'sprawny') !== 'sprawny') {
        $problemy[] = "Statek {$statek['nazwa']} nie jest sprawny ({$statek['stan']}).";
    }
    $przystanki = $szlak['przystanki'] ?? [];
    if (count($przystanki) < 2) {
        $problemy[] = 'Szlak potrzebuje co najmniej dwóch przystanków.';
    }
    if ($przystanki && ($statek['lokalizacja'] ?? '') !== '' && $przystanki[0]['planeta'] !== $statek['lokalizacja']) {
        $nazwa = $planety[$statek['lokalizacja']]['nazwa'] ?? '?';
        $problemy[] = "Statek stoi na: $nazwa. Pierwszy przystanek musi być tam.";
    }

    $magazyn = [];
    foreach ($dane['magazyn'] as $m) {
        $magazyn[$m['planeta'] . '|' . $m['towar']] = (int) $m['ilosc'];
    }
    $ladownia = [];
    $ladownosc = (int) ($statek['ladownosc'] ?? 0);

    foreach ($przystanki as $i => $p) {
        $nr = $i + 1;
        if (!isset($planety[$p['planeta'] ?? ''])) {
            $problemy[] = "Przystanek $nr: nieznana planeta.";
            continue;
        }
        $nazwaPl = $planety[$p['planeta']]['nazwa'];
        $operacje = $p['operacje'] ?? [];
        usort($operacje, fn($a, $b) => ($a['typ'] === 'rozladunek' ? 0 : 1) <=> ($b['typ'] === 'rozladunek' ? 0 : 1));
        foreach ($operacje as $o) {
            $t = $towary[$o['towar'] ?? ''] ?? null;
            $ilosc = (int) ($o['ilosc'] ?? 0);
            if (!$t || $ilosc <= 0) {
                $problemy[] = "Przystanek $nr ($nazwaPl): nieprawidłowa operacja.";
                continue;
            }
            $klucz = $p['planeta'] . '|' . $t['id'];
            if ($o['typ'] === 'rozladunek') {
                $naPokladzie = $ladownia[$t['id']] ?? 0;
                if ($ilosc > $naPokladzie) {
                    $problemy[] = "Przystanek $nr ($nazwaPl): rozładunek {$ilosc} {$t['jednostka']} {$t['nazwa']}, a na pokładzie jest $naPokladzie.";
                    $ilosc = $naPokladzie;
                }
                $ladownia[$t['id']] = $naPokladzie - $ilosc;
                $magazyn[$klucz] = ($magazyn[$klucz] ?? 0) + $ilosc;
            } else {
                $wMagazynie = $magazyn[$klucz] ?? 0;
                if ($ilosc > $wMagazynie) {
                    $problemy[] = "Przystanek $nr ($nazwaPl): załadunek {$ilosc} {$t['jednostka']} {$t['nazwa']}, a w magazynie jest $wMagazynie.";
                }
                $magazyn[$klucz] = max(0, $wMagazynie - $ilosc);
                $ladownia[$t['id']] = ($ladownia[$t['id']] ?? 0) + $ilosc;
            }
        }
        $masa = 0;
        foreach ($ladownia as $tid => $il) {
            $masa += $il * (int) ($towary[$tid]['masa'] ?? 1);
        }
        if ($masa > $ladownosc) {
            $problemy[] = "Przystanek $nr ($nazwaPl): ładunek $masa t przekracza ładowność $ladownosc t.";
        }
    }
    if (array_sum($ladownia) > 0) {
        $problemy[] = 'Po ostatnim przystanku w ładowni zostaje towar. Rozładuj go albo dodaj przystanek.';
    }
    return $problemy;
}

// Zakończony kurs: towar z magazynów przechodzi zgodnie z planem, statek zostaje na ostatniej planecie.
function transport_rozlicz_szlak(array &$dane, array $szlak): void
{
    $magazyn = [];
    foreach ($dane['magazyn'] as $m) {
        $magazyn[$m['planeta'] . '|' . $m['towar']] = (int) $m['ilosc'];
    }
    foreach ($szlak['przystanki'] as $p) {
        foreach ($p['operacje'] ?? [] as $o) {
            $k = $p['planeta'] . '|' . $o['towar'];
            $zmiana = $o['typ'] === 'rozladunek' ? (int) $o['ilosc'] : -(int) $o['ilosc'];
            $magazyn[$k] = max(0, ($magazyn[$k] ?? 0) + $zmiana);
        }
    }
    $dane['magazyn'] = [];
    foreach ($magazyn as $k => $il) {
        if ($il > 0) {
            [$planeta, $towar] = explode('|', $k, 2);
            $dane['magazyn'][] = ['planeta' => $planeta, 'towar' => $towar, 'ilosc' => $il];
        }
    }
    $ostatni = end($szlak['przystanki']);
    foreach ($dane['flota'] as &$s) {
        if ($s['id'] === $szlak['statek']) {
            $s['lokalizacja'] = $ostatni['planeta'];
            $s['stan'] = 'sprawny';
        }
    }
}

function transport_ustaw_stan_statku(array &$dane, string $statek, string $stan): void
{
    foreach ($dane['flota'] as &$s) {
        if ($s['id'] === $statek) {
            $s['stan'] = $stan;
        }
    }
}

// Czyszczenie szlaku przysłanego przez gracza: tylko znane pola, liczby całkowite.
function transport_oczysc_szlak(array $w): array
{
    $przystanki = [];
    foreach (array_slice((array) ($w['przystanki'] ?? []), 0, 30) as $p) {
        $operacje = [];
        foreach (array_slice((array) ($p['operacje'] ?? []), 0, 30) as $o) {
            $operacje[] = [
                'typ' => ($o['typ'] ?? '') === 'rozladunek' ? 'rozladunek' : 'zaladunek',
                'towar' => mb_substr((string) ($o['towar'] ?? ''), 0, 32),
                'ilosc' => max(0, (int) ($o['ilosc'] ?? 0)),
            ];
        }
        $przystanki[] = ['planeta' => mb_substr((string) ($p['planeta'] ?? ''), 0, 32), 'operacje' => $operacje];
    }
    return [
        'id' => mb_substr((string) ($w['id'] ?? ''), 0, 32),
        'nazwa' => mb_substr(trim((string) ($w['nazwa'] ?? '')), 0, 80) ?: 'Kurs bez nazwy',
        'statek' => mb_substr((string) ($w['statek'] ?? ''), 0, 32),
        'przystanki' => $przystanki,
        'notatka' => mb_substr(trim((string) ($w['notatka'] ?? '')), 0, 500),
    ];
}

// Operacje gracza w firmie transportowej. $moze_zmieniac = właściciel lub menedżer.
function transport_operacja(array &$firma, string $op, array $w, array $u, bool $moze_zmieniac): array
{
    $dane = &$firma['dane'];
    if (!$moze_zmieniac) {
        blad('Twoje uprawnienia w firmie pozwalają tylko na podgląd.', 403);
    }
    switch ($op) {
        case 'statek_nazwa':
            $nazwa = mb_substr(trim((string) ($w['nazwa'] ?? '')), 0, 60);
            if ($nazwa === '') blad('Podaj nazwę statku.');
            foreach ($dane['flota'] as &$s) {
                if ($s['id'] === ($w['statek'] ?? '')) {
                    $s['nazwa'] = $nazwa;
                    return ['ok' => true];
                }
            }
            blad('Nie ma takiego statku.', 404);

        case 'przydziel':
            // Osoba na statek albo (w profilach z budynkami) do budynku, albo do bazy (oba puste).
            // Opcjonalnie jako kapitan statku / kierownik budynku.
            $statek = (string) ($w['statek'] ?? '');
            $budynek = (string) ($w['budynek'] ?? '');
            if ($statek !== '' && $budynek !== '') blad('Osoba może być albo na statku, albo w budynku.');
            if ($statek !== '' && !in_array($statek, array_column($dane['flota'], 'id'), true)) blad('Nie ma takiego statku.', 404);
            if ($budynek !== '' && !in_array($budynek, array_column($dane['budynki'] ?? [], 'id'), true)) blad('Nie ma takiego budynku.', 404);
            $znaleziony = false;
            foreach ($dane['zaloga'] as &$z) {
                if ($z['id'] === ($w['czlonek'] ?? '')) {
                    if (($z['stan'] ?? '') === 'na misji') blad('Ta osoba jest na misji.');
                    $z['statek'] = $statek;
                    $z['budynek'] = $budynek;
                    $znaleziony = true;
                }
            }
            unset($z);
            if (!$znaleziony) blad('Nie ma takiej osoby w załodze.', 404);
            if (isset($dane['budynki'])) {
                foreach ($dane['budynki'] as &$b) {
                    if (!empty($w['menedzer']) && $b['id'] === $budynek) {
                        $b['menedzer'] = $w['czlonek'];
                    } elseif (($b['menedzer'] ?? '') === $w['czlonek'] && $b['id'] !== $budynek) {
                        $b['menedzer'] = '';
                    }
                }
                unset($b);
            }
            // Kapitan musi być na swoim statku.
            foreach ($dane['flota'] as &$s) {
                if (!empty($w['kapitan']) && $s['id'] === $statek) {
                    $s['kapitan'] = $w['czlonek'];
                } elseif (($s['kapitan'] ?? '') === $w['czlonek'] && $s['id'] !== $statek) {
                    $s['kapitan'] = '';
                }
            }
            return ['ok' => true];

        case 'budynek_pracownicy':
            // Prosta obsada: liczba pracowników od 0 do pojemności budynku.
            foreach ($dane['budynki'] as &$b) {
                if ($b['id'] === ($w['budynek'] ?? '')) {
                    $b['pracownicy'] = max(0, min((int) $b['pojemnosc'], (int) ($w['pracownicy'] ?? 0)));
                    return ['ok' => true];
                }
            }
            blad('Nie ma takiego budynku.', 404);

        case 'budynek_kup':
            // Zakup z rynku nieruchomości: płaci rachunek firmy, oferta znika z rynku.
            $oid = (string) ($w['oferta'] ?? '');
            $fid = $firma['id'];
            $budynek = zmien('katalog', function (&$kat) use ($oid, $fid, $firma) {
                foreach ($kat['oferty'] ?? [] as $i => $o) {
                    if ($o['id'] !== $oid) continue;
                    $wynik = zmien('bank', fn(&$bank) => bank_obciaz($bank, 'f:' . $fid, (int) $o['cena'], 'Pośrednik nieruchomości', 'Zakup: ' . $o['nazwa'], bank_wlasciciele() + ['f:' . $fid => $firma['nazwa']]), bank_pusty());
                    if ($wynik !== 'ok') blad('Na rachunku firmy brakuje środków (cena: ' . $o['cena'] . ' kr).');
                    array_splice($kat['oferty'], $i, 1);
                    return ['id' => id(), 'nazwa' => $o['nazwa'], 'typ' => $o['typ'] ?? '', 'planeta' => $o['planeta'] ?? '',
                        'pojemnosc' => (int) ($o['pojemnosc'] ?? 0), 'pracownicy' => 0, 'pensja' => (int) ($o['pensja'] ?? 0),
                        'menedzer' => '', 'opis' => $o['opis'] ?? ''];
                }
                blad('Ta oferta jest już nieaktualna.', 404);
            });
            $dane['budynki'][] = $budynek;
            return ['ok' => true];

        case 'test':
            foreach ($dane['zaloga'] as &$z) {
                if ($z['id'] !== ($w['czlonek'] ?? '')) continue;
                $z['ocena'] = test_ocena($z['statystyki'] ?? [], $z['ocena'] ?? null, $u['postac']);
                return ['ok' => true, 'ocena' => $z['ocena']];
            }
            blad('Nie ma takiej osoby.', 404);

        case 'kandydat_test':
            $fid = $firma['id'];
            $pula = PULA_PROFILU[$firma['profil']] ?? 'ogolna';
            $ocena = zmien('kandydaci', function (&$k) use ($w, $fid, $pula, $u) {
                foreach ($k['lista'] as &$x) {
                    if ($x['id'] !== ($w['kandydat'] ?? '') || ($x['pula'] ?? 'ogolna') !== $pula) continue;
                    $x['testy'][$fid] = test_ocena($x['statystyki'] ?? [], $x['testy'][$fid] ?? null, $u['postac']);
                    return $x['testy'][$fid];
                }
                blad('Ten kandydat nie jest już dostępny.', 404);
            }, kandydaci_puste());
            return ['ok' => true, 'ocena' => $ocena];

        case 'kandydat_zatrudnij':
            $fid = $firma['id'];
            $pula = PULA_PROFILU[$firma['profil']] ?? 'ogolna';
            $k = zmien('kandydaci', function (&$kk) use ($w, $pula) {
                foreach ($kk['lista'] as $i => $x) {
                    if ($x['id'] !== ($w['kandydat'] ?? '') || ($x['pula'] ?? 'ogolna') !== $pula) continue;
                    array_splice($kk['lista'], $i, 1);
                    return $x;
                }
                blad('Ten kandydat nie jest już dostępny.', 404);
            }, kandydaci_puste());
            $dane['zaloga'][] = [
                'id' => id(), 'imie' => $k['imie'], 'funkcja' => $k['funkcja'] ?? '', 'pensja' => (int) ($k['pensja'] ?? 0),
                'statek' => '', 'budynek' => '', 'stan' => 'zdrowy', 'statystyki' => $k['statystyki'] ?? [],
                'ocena' => $k['testy'][$fid] ?? null, 'kryptonim' => $k['kryptonim'] ?? '', 'gracz' => '',
            ];
            return ['ok' => true];

        case 'przelew':
            // Przelew z rachunku firmy na dowolny rachunek.
            $numer = bank_numer((string) ($w['numer'] ?? ''));
            $kwota = bank_kwota($w['kwota'] ?? null);
            if ($kwota <= 0) blad('Kwota musi być większa od zera.');
            $tytul = mb_substr(trim((string) ($w['tytul'] ?? '')), 0, 140);
            $klucz = 'f:' . $firma['id'];
            $wynik = zmien('bank', fn(&$bank) => bank_przelej($bank, $klucz, $numer, $kwota, $tytul, bank_wlasciciele() + [$klucz => $firma['nazwa']]), bank_pusty());
            bank_blad_przelewu($wynik);
            return ['ok' => true];

        case 'szlak_zapisz':
        case 'szlak_zglos':
            $s = transport_oczysc_szlak($w['szlak'] ?? []);
            $stary = null;
            foreach ($dane['szlaki'] as $x) {
                if ($x['id'] === $s['id']) $stary = $x;
            }
            if ($stary && !in_array($stary['status'], ['szkic', 'odrzucony'], true)) blad('Zgłoszonego kursu nie można już zmieniać.');
            $problemy = transport_sprawdz_szlak($s, $dane, katalog());
            if ($op === 'szlak_zglos') {
                if ($problemy) odpowiedz(['blad' => 'Plan kursu zawiera błędy.', 'problemy' => $problemy], 400);
                foreach ($dane['szlaki'] as $x) {
                    if ($x['statek'] === $s['statek'] && $x['id'] !== $s['id'] && in_array($x['status'], ['zgloszony', 'w_realizacji'], true)) {
                        blad('Ten statek ma już zgłoszony lub trwający kurs.');
                    }
                }
            }
            $s['id'] = $s['id'] ?: id();
            $s['status'] = $op === 'szlak_zglos' ? 'zgloszony' : 'szkic';
            $s['autor'] = $u['postac'];
            $s['zmieniono'] = date('c');
            $s['uwagi'] = $stary['uwagi'] ?? '';
            $dane['szlaki'] = array_values(array_filter($dane['szlaki'], fn($x) => $x['id'] !== $s['id']));
            $dane['szlaki'][] = $s;
            return ['ok' => true, 'id' => $s['id'], 'problemy' => $problemy];

        case 'szlak_usun':
            $sid = (string) ($w['id'] ?? '');
            foreach ($dane['szlaki'] as $x) {
                if ($x['id'] === $sid && !in_array($x['status'], ['szkic', 'odrzucony', 'zakonczony'], true)) {
                    blad('Kursu w realizacji nie można usunąć.');
                }
            }
            $dane['szlaki'] = array_values(array_filter($dane['szlaki'], fn($x) => $x['id'] !== $sid));
            return ['ok' => true];
    }
    blad('Nieznana operacja.', 404);
}

function obsluz_firmy(string $akcja, bool $post): void
{
    switch ($akcja) {

        case 'firmy':
            $u = wymagaj_logowania();
            $lista = [];
            foreach (wczytaj('firmy', firmy_puste())['firmy'] as $f) {
                $rola = firma_rola($f, $u['id']);
                if ($rola) $lista[] = ['id' => $f['id'], 'nazwa' => $f['nazwa'], 'profil' => $f['profil'], 'rola' => $rola];
            }
            odpowiedz(['firmy' => $lista]);

        case 'firma':
            $u = wymagaj_logowania();
            $fid = (string) ($_GET['id'] ?? '');
            $postacie = bank_postacie();
            foreach (wczytaj('firmy', firmy_puste())['firmy'] as $f) {
                if ($f['id'] !== $fid) continue;
                $rola = firma_rola($f, $u['id']);
                if (!$rola && $u['rola'] !== 'mg') blad('Brak dostępu do danych tej firmy.', 403);
                $f['czlonkowie'] = array_map(fn($c) => $c + ['postac' => $postacie[$c['uid']] ?? '?'], $f['czlonkowie']);
                $klucz = 'f:' . $f['id'];
                $finanse = zmien('bank', fn(&$bank) => bank_wyciag($bank, $klucz, 40), bank_pusty());
                odpowiedz([
                    'firma' => firma_dla_gracza($f),
                    'rola' => $rola ?? 'wlasciciel',
                    'katalog' => katalog(),
                    'finanse' => $finanse,
                    'kandydaci' => kandydaci_dla_firmy($f),
                ]);
            }
            blad('Nie ma takiej firmy.', 404);

        case 'firma_operacja':
            if (!$post) blad('Zła metoda.', 405);
            $u = wymagaj_logowania();
            $w = wejscie();
            $fid = (string) ($w['firma'] ?? '');
            $op = (string) ($w['op'] ?? '');
            $wynik = zmien('firmy', function (&$wszystko) use ($fid, $op, $w, $u) {
                foreach ($wszystko['firmy'] as &$f) {
                    if ($f['id'] !== $fid) continue;
                    $rola = firma_rola($f, $u['id']) ?? ($u['rola'] === 'mg' ? 'wlasciciel' : null);
                    if (!$rola) blad('Brak dostępu do danych tej firmy.', 403);
                    $f['dane'] += firma_dane_puste($f['profil']); // starsze firmy mogą nie mieć nowych list
                    $moze = in_array($rola, ['wlasciciel', 'menedzer'], true);
                    return match ($f['profil']) {
                        'transport' => transport_operacja($f, $op, $w, $u, $moze),
                        'komorka' => komorka_operacja($f, $op, $w, $u, $moze),
                        'agencja' => agencja_operacja($f, $op, $w, $u, $moze),
                    };
                }
                blad('Nie ma takiej firmy.', 404);
            }, firmy_puste());
            odpowiedz($wynik);

        // Podgląd poprawności szlaku bez zapisywania (gracz widzi problemy na bieżąco).
        case 'firma_sprawdz_szlak':
            if (!$post) blad('Zła metoda.', 405);
            $u = wymagaj_logowania();
            $w = wejscie();
            foreach (wczytaj('firmy', firmy_puste())['firmy'] as $f) {
                if ($f['id'] !== ($w['firma'] ?? '')) continue;
                if (!firma_rola($f, $u['id']) && $u['rola'] !== 'mg') blad('Brak dostępu.', 403);
                odpowiedz(['problemy' => transport_sprawdz_szlak(transport_oczysc_szlak($w['szlak'] ?? []), $f['dane'], katalog())]);
            }
            blad('Nie ma takiej firmy.', 404);

        // ----- panel MG -----

        case 'mg_katalog':
            wymagaj_mg();
            odpowiedz(['katalog' => katalog()]);

        case 'mg_katalog_zapisz':
            if (!$post) blad('Zła metoda.', 405);
            wymagaj_mg();
            $w = wejscie();
            $towary = nadaj_id((array) ($w['towary'] ?? []));
            $planety = nadaj_id((array) ($w['planety'] ?? []));
            foreach ($towary as &$t) {
                if (trim((string) ($t['nazwa'] ?? '')) === '') blad('Każdy towar musi mieć nazwę.');
                $t['masa'] = max(1, (int) ($t['masa'] ?? 1));
                $t['jednostka'] = (string) ($t['jednostka'] ?? 't');
            }
            unset($t);
            foreach ($planety as $p) {
                if (trim((string) ($p['nazwa'] ?? '')) === '') blad('Każda planeta musi mieć nazwę.');
            }
            // Rynek nieruchomości: oferty budynków do kupienia przez firmy (każda oferta = jeden budynek).
            $oferty = nadaj_id((array) ($w['oferty'] ?? []));
            foreach ($oferty as &$o) {
                if (trim((string) ($o['nazwa'] ?? '')) === '') blad('Każda oferta musi mieć nazwę.');
                $o['cena'] = max(0, (int) ($o['cena'] ?? 0));
                $o['pojemnosc'] = max(0, (int) ($o['pojemnosc'] ?? 0));
                $o['pensja'] = max(0, (int) ($o['pensja'] ?? 0));
                $o['planeta'] = ($o['planeta'] ?? '') === '' ? '' : katalog_id($planety, (string) $o['planeta'], 'planeta');
            }
            unset($o);
            zmien('katalog', function (&$k) use ($towary, $planety, $oferty) {
                $k = ['towary' => $towary, 'planety' => $planety, 'oferty' => $oferty];
            });
            odpowiedz(['ok' => true]);

        case 'mg_kandydaci':
            wymagaj_mg();
            odpowiedz(['kandydaci' => wczytaj('kandydaci', kandydaci_puste())['lista']]);

        case 'mg_kandydaci_zapisz':
            // Pula do zatrudnienia. Wyniki testów („testy”) zostają, edytor ich nie rusza.
            if (!$post) blad('Zła metoda.', 405);
            wymagaj_mg();
            $lista = nadaj_id((array) (wejscie()['kandydaci'] ?? []));
            foreach ($lista as &$k) {
                if (trim((string) ($k['imie'] ?? '')) === '') blad('Każdy kandydat musi mieć imię.');
                $k['pula'] = ($k['pula'] ?? 'ogolna') === 'agencja' ? 'agencja' : 'ogolna';
                $k['pensja'] = max(0, (int) ($k['pensja'] ?? 0));
                $k['statystyki'] = oczysc_statystyki($k['statystyki'] ?? []);
                unset($k['testy']);
            }
            unset($k);
            zmien('kandydaci', function (&$kk) use ($lista) {
                $testy = array_column($kk['lista'], 'testy', 'id');
                foreach ($lista as &$k) {
                    $k['testy'] = $testy[$k['id']] ?? [];
                }
                $kk['lista'] = $lista;
            }, kandydaci_puste());
            odpowiedz(['ok' => true]);

        case 'mg_firmy':
            wymagaj_mg();
            odpowiedz(['firmy' => wczytaj('firmy', firmy_puste())['firmy'], 'katalog' => katalog()]);

        case 'mg_firma_zapisz':
            // Nazwa, profil, członkowie oraz (opcjonalnie) całe dane profilu z edytora JSON.
            if (!$post) blad('Zła metoda.', 405);
            wymagaj_mg();
            $w = wejscie();
            $profil = (string) ($w['profil'] ?? '');
            if (!in_array($profil, PROFILE_FIRM, true)) blad('Nieznany profil firmy.');
            $nazwa = mb_substr(trim((string) ($w['nazwa'] ?? '')), 0, 80);
            if ($nazwa === '') blad('Podaj nazwę firmy.');
            $postacie = bank_postacie();
            $czlonkowie = [];
            foreach ((array) ($w['czlonkowie'] ?? []) as $c) {
                if (isset($postacie[$c['uid'] ?? '']) && in_array($c['rola'] ?? '', ROLE_FIRMY, true)) {
                    $czlonkowie[$c['uid']] = ['uid' => $c['uid'], 'rola' => $c['rola']];
                }
            }
            // Dane profilu z edytora MG. Kursy (szlaki) zostają nietknięte: zmienia je tylko gra.
            // Planety i towary można podać po nazwie albo po id.
            $dane = null;
            if (isset($w['dane'])) {
                $kat = katalog();
                $dane = [];
                foreach (firma_edytowalne($profil) as $k) {
                    if (!isset($w['dane'][$k]) || !is_array($w['dane'][$k])) blad("Brak listy: $k");
                    $dane[$k] = $k === 'magazyn' ? array_values($w['dane'][$k]) : nadaj_id(array_values($w['dane'][$k]));
                }
                foreach ($dane['flota'] as &$st) {
                    $st['nazwa'] = (string) ($st['nazwa'] ?? '') ?: 'Statek bez nazwy';
                    $st['ladownosc'] = max(0, (int) ($st['ladownosc'] ?? 0));
                    $st['stan'] = in_array($st['stan'] ?? '', STANY_STATKU, true) ? $st['stan'] : 'sprawny';
                    $st['lokalizacja'] = ($st['lokalizacja'] ?? '') === '' ? '' : katalog_id($kat['planety'], (string) $st['lokalizacja'], 'planeta');
                    $st['kapitan'] = (string) ($st['kapitan'] ?? '');
                }
                unset($st);
                foreach ($dane['zaloga'] as &$z) {
                    $z['imie'] = (string) ($z['imie'] ?? '') ?: 'Bez imienia';
                    $z['pensja'] = max(0, (int) ($z['pensja'] ?? 0));
                    $z['statek'] = (string) ($z['statek'] ?? '');
                    $z['budynek'] = (string) ($z['budynek'] ?? '');
                    $z['stan'] = in_array($z['stan'] ?? '', STANY_OSOBY, true) ? $z['stan'] : 'zdrowy';
                    $z['statystyki'] = oczysc_statystyki($z['statystyki'] ?? []);
                    $z['kryptonim'] = (string) ($z['kryptonim'] ?? '');
                    // „gracz”: postać gracza, którą ta osoba jest (login albo nazwa postaci) — wtedy
                    // wypłaty trafiają na jej rachunek w banku.
                    $z['gracz'] = (string) ($z['gracz'] ?? '');
                    if ($z['gracz'] !== '') {
                        $znaleziony = '';
                        foreach (uzytkownicy() as $us) {
                            if (in_array(mb_strtolower($z['gracz']), [mb_strtolower($us['login']), mb_strtolower($us['postac']), $us['id']], true)) $znaleziony = $us['id'];
                        }
                        if ($znaleziony === '') blad("Nie ma gracza „{$z['gracz']}”.");
                        $z['gracz'] = $znaleziony;
                    }
                }
                unset($z);
                // Przydział załogi po nazwie statku, kapitan po imieniu.
                foreach ($dane['zaloga'] as &$z) {
                    if ($z['statek'] === '') continue;
                    $z['statek'] = katalog_id($dane['flota'], $z['statek'], 'statek');
                }
                unset($z);
                $osoby = array_map(fn($z) => ['id' => $z['id'], 'nazwa' => $z['imie']], $dane['zaloga']);
                if (isset($dane['budynki'])) {
                    $dane['budynki'] = nadaj_id($dane['budynki']);
                    foreach ($dane['budynki'] as &$b) {
                        $b['nazwa'] = (string) ($b['nazwa'] ?? '') ?: 'Budynek';
                        $b['typ'] = (string) ($b['typ'] ?? '');
                        $b['planeta'] = ($b['planeta'] ?? '') === '' ? '' : katalog_id($kat['planety'], (string) $b['planeta'], 'planeta');
                        $b['pojemnosc'] = max(0, (int) ($b['pojemnosc'] ?? 0));
                        $b['pracownicy'] = max(0, min($b['pojemnosc'], (int) ($b['pracownicy'] ?? 0)));
                        $b['pensja'] = max(0, (int) ($b['pensja'] ?? 0));
                        $b['menedzer'] = ($b['menedzer'] ?? '') === '' ? '' : katalog_id($osoby, (string) $b['menedzer'], 'osoba w załodze');
                    }
                    unset($b);
                    foreach ($dane['zaloga'] as &$z) {
                        if ($z['budynek'] !== '') $z['budynek'] = katalog_id($dane['budynki'], $z['budynek'], 'budynek');
                        foreach ($dane['budynki'] as $b) {
                            if ($b['menedzer'] === $z['id']) { $z['budynek'] = $b['id']; $z['statek'] = ''; }
                        }
                    }
                    unset($z);
                }
                foreach ($dane['flota'] as &$st) {
                    if ($st['kapitan'] === '') continue;
                    $st['kapitan'] = katalog_id($osoby, $st['kapitan'], 'osoba w załodze');
                    foreach ($dane['zaloga'] as &$z) {
                        if ($z['id'] === $st['kapitan']) $z['statek'] = $st['id'];
                    }
                    unset($z);
                }
                unset($st);
                foreach ($dane['magazyn'] as &$m) {
                    $m = [
                        'planeta' => katalog_id($kat['planety'], (string) ($m['planeta'] ?? ''), 'planeta'),
                        'towar' => katalog_id($kat['towary'], (string) ($m['towar'] ?? ''), 'towar'),
                        'ilosc' => max(0, (int) ($m['ilosc'] ?? 0)),
                    ];
                }
                unset($m);
            }
            $fid = (string) ($w['id'] ?? '');
            $wynik = zmien('firmy', function (&$wszystko) use ($fid, $profil, $nazwa, $czlonkowie, $dane) {
                foreach ($wszystko['firmy'] as &$f) {
                    if ($f['id'] === $fid) {
                        if ($f['profil'] !== $profil) blad('Profilu istniejącej firmy nie można zmienić.');
                        $f['nazwa'] = $nazwa;
                        $f['czlonkowie'] = array_values($czlonkowie);
                        if ($dane !== null) $f['dane'] = array_merge($f['dane'], $dane);
                        return $f['id'];
                    }
                }
                unset($f);
                $nowa = ['id' => id(), 'nazwa' => $nazwa, 'profil' => $profil, 'czlonkowie' => array_values($czlonkowie),
                    'dane' => array_merge(firma_dane_puste($profil), $dane ?? [])];
                $wszystko['firmy'][] = $nowa;
                return $nowa['id'];
            }, firmy_puste());
            odpowiedz(['ok' => true, 'id' => $wynik]);

        case 'mg_firma_usun':
            if (!$post) blad('Zła metoda.', 405);
            wymagaj_mg();
            $fid = pole('id', 32);
            zmien('firmy', function (&$wszystko) use ($fid) {
                $wszystko['firmy'] = array_values(array_filter($wszystko['firmy'], fn($f) => $f['id'] !== $fid));
            }, firmy_puste());
            odpowiedz(['ok' => true]);

        // Decyzja MG o zgłoszonym kursie: przyjęcie (w realizacji), zakończenie (rozliczenie magazynów
        // i położenia statku) albo odrzucenie z uwagą dla graczy.
        case 'mg_szlak_status':
            if (!$post) blad('Zła metoda.', 405);
            wymagaj_mg();
            $w = wejscie();
            $status = (string) ($w['status'] ?? '');
            if (!in_array($status, ['w_realizacji', 'zakonczony', 'odrzucony'], true)) blad('Nieprawidłowy status.');
            $uwagi = mb_substr(trim((string) ($w['uwagi'] ?? '')), 0, 500);
            zmien('firmy', function (&$wszystko) use ($w, $status, $uwagi) {
                foreach ($wszystko['firmy'] as &$f) {
                    if ($f['id'] !== ($w['firma'] ?? '')) continue;
                    foreach ($f['dane']['szlaki'] as &$s) {
                        if ($s['id'] !== ($w['szlak'] ?? '')) continue;
                        $dozwolone = ['zgloszony' => ['w_realizacji', 'odrzucony'], 'w_realizacji' => ['zakonczony', 'odrzucony']];
                        if (!in_array($status, $dozwolone[$s['status']] ?? [], true)) blad('Tej zmiany statusu nie można wykonać.');
                        // Magazyny mogły się zmienić od zgłoszenia (np. inny kurs zabrał towar),
                        // więc przed przyjęciem i przed rozliczeniem plan jest sprawdzany jeszcze raz.
                        if ($status !== 'odrzucony') {
                            $problemy = transport_sprawdz_szlak($s, $f['dane'], katalog(), $s['status'] === 'w_realizacji');
                            if ($problemy) blad('Plan nie zgadza się z obecnym stanem: ' . implode(' ', $problemy) . ' Odrzuć kurs z uwagą albo popraw magazyn.');
                        }
                        if ($status === 'w_realizacji') transport_ustaw_stan_statku($f['dane'], $s['statek'], 'w trasie');
                        if ($status === 'odrzucony' && $s['status'] === 'w_realizacji') transport_ustaw_stan_statku($f['dane'], $s['statek'], 'sprawny');
                        if ($status === 'zakonczony') transport_rozlicz_szlak($f['dane'], $s);
                        $s['status'] = $status;
                        $s['uwagi'] = $uwagi;
                        $s['zmieniono'] = date('c');
                        return;
                    }
                }
                blad('Nie ma takiego kursu.', 404);
            }, firmy_puste());
            odpowiedz(['ok' => true]);
    }
}
