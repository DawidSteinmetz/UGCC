<?php
// Giełda CDEX: spółki i towary notowane na giełdach planetarnych.
//
// DANE (pliki JSON w api/dane, poza gitem):
//   gielda            — definicje: giełdy, instrumenty, ustawienia (edytuje MG).
//   gielda_notowania  — kursy dzienne: { SYMBOL: { od: "Y-m-d", c: [kurs, kurs, ...] } }.
//   gielda_portfele   — portfele postaci i ich historia transakcji.
//
// SKRYPT KURSÓW. Każdy dzień liczony jest z poprzedniego:
//   ln P(d) = ln P(d−1) + powrót · (ln F(d) − ln P(d−1)) + σ · niepewność · ε(symbol, d)
// F to „wartość godziwa”: cena bazowa × mnożniki aktywnych wydarzeń (wydarzenia.php).
// Bez wydarzeń kurs błądzi wokół ceny bazowej (zwykłe wahania). Wydarzenie przesuwa F,
// a kurs w kilka dni dochodzi do nowego poziomu; po końcu wydarzenia wraca.
// ε jest wyznaczone przez symbol i datę, więc podgląd MG pokazuje dokładnie tę przyszłość,
// która nastąpi, jeśli nikt nie zmieni wydarzeń. Dni dopisują się same przy wejściu na giełdę.

declare(strict_types=1);

const GIELDA_HISTORIA_TRANSAKCJI = 60;
const GIELDA_MAX_DNI = 730;

function gielda_ustawienia_domyslne(): array
{
    return ['powrot' => 0.08, 'zmiennosc_spolka' => 0.018, 'zmiennosc_towar' => 0.025, 'prowizja' => 0.005, 'historia_dni' => 365];
}

// Początkowa giełda. MG zmienia ją w panelu; to tylko punkt startu.
function gielda_domyslna(): array
{
    $s = fn($symbol, $nazwa, $kategoria, $gielda, $cena, $pochodzenie, $zm = null) =>
        ['symbol' => $symbol, 'nazwa' => $nazwa, 'rodzaj' => 'spolka', 'kategoria' => $kategoria, 'gielda' => $gielda, 'cena' => $cena, 'jednostka' => 'akcja', 'pochodzenie' => $pochodzenie] + ($zm ? ['zmiennosc' => $zm] : []);
    $t = fn($symbol, $nazwa, $kategoria, $gielda, $cena, $jednostka, $pochodzenie, $zm = null) =>
        ['symbol' => $symbol, 'nazwa' => $nazwa, 'rodzaj' => 'towar', 'kategoria' => $kategoria, 'gielda' => $gielda, 'cena' => $cena, 'jednostka' => $jednostka, 'pochodzenie' => $pochodzenie] + ($zm ? ['zmiennosc' => $zm] : []);
    return [
        'gieldy' => [
            ['id' => 'cor', 'nazwa' => 'Galaktyczna Giełda Coruscant', 'planeta' => 'Coruscant'],
            ['id' => 'crl', 'nazwa' => 'Giełda Coronet', 'planeta' => 'Corellia'],
            ['id' => 'kua', 'nazwa' => 'Giełda Stoczniowa Kuat', 'planeta' => 'Kuat'],
            ['id' => 'bsp', 'nazwa' => 'Giełda Tibanny w Mieście w Chmurach', 'planeta' => 'Bespin'],
            ['id' => 'nar', 'nazwa' => 'Rynek Huttów na Nar Shaddaa', 'planeta' => 'Nar Shaddaa'],
        ],
        'instrumenty' => [
            // spółki: kategoria = branża
            $s('KDY', 'Kuat Drive Yards', 'stocznie', 'kua', 520, 'Kuat'),
            $s('SFS', 'Sienar Fleet Systems', 'stocznie', 'cor', 310, 'Lothal'),
            $s('CEC', 'Corellian Engineering Corporation', 'stocznie', 'crl', 280, 'Corellia'),
            $s('INC', 'Incom Corporation', 'stocznie', 'cor', 240, 'Fresia'),
            $s('NDC', 'Nubian Design Collective', 'stocznie', 'cor', 150, 'Naboo'),
            $s('RSD', 'Rendili StarDrive', 'stocznie', 'kua', 190, 'Rendili'),
            $s('BLT', 'BlasTech Industries', 'uzbrojenie', 'cor', 175, 'Coruscant'),
            $s('MSM', 'Merr-Sonn Munitions', 'uzbrojenie', 'cor', 140, 'Carida'),
            $s('CZK', 'Czerka Corporation', 'uzbrojenie', 'cor', 95, 'Coruscant', 0.024),
            $s('CYB', 'Cybot Galactica', 'droidy', 'cor', 160, 'Affa'),
            $s('IAU', 'Industrial Automaton', 'droidy', 'cor', 130, 'Coruscant'),
            $s('SRS', 'SoroSuub Corporation', 'elektronika', 'cor', 150, 'Sullust'),
            $s('LOR', 'Loronar Corporation', 'elektronika', 'crl', 90, 'Loronar'),
            $s('MGU', 'Gildia Górnicza', 'górnictwo', 'cor', 85, 'Coruscant'),
            $s('BES', 'Bespin Motors i Tibanna', 'górnictwo', 'bsp', 210, 'Bespin'),
            $s('XTS', 'Xizor Transport Systems', 'transport', 'cor', 120, 'Coruscant'),
            $s('HCL', 'Kartel Huttów — Logistyka', 'transport', 'nar', 70, 'Nal Hutta', 0.03),
            $s('IBC', 'Międzygalaktyczny Klan Bankowy', 'finanse', 'cor', 400, 'Muunilinst', 0.012),
            $s('GIZ', 'Gizer Żywność i Napoje', 'żywność', 'crl', 60, 'Gizer'),
            // towary: kategoria = grupa towarów (te same nazwy co w katalogu firm)
            $t('COAX', 'Coaxium surowe', 'paliwo', 'nar', 1200, 'kg', 'Kessel', 0.04),
            $t('COAXR', 'Coaxium rafinowane', 'paliwo', 'cor', 2600, 'kg', 'Kessel', 0.03),
            $t('TIBP', 'Gaz tibanna przemysłowy', 'paliwo', 'bsp', 340, 'zbiornik', 'Bespin'),
            $t('TIBW', 'Gaz tibanna wysokiej czystości', 'paliwo', 'bsp', 720, 'zbiornik', 'Bespin'),
            $t('PLZ', 'Plazma z Naboo', 'paliwo', 'cor', 480, 'ogniwo', 'Naboo'),
            $t('OGN', 'Ogniwa paliwowe', 'paliwo', 'crl', 60, 'skrzynia', 'Corellia'),
            $t('DUR', 'Durastal', 'surowce', 'kua', 140, 't', 'Kuat'),
            $t('DOON', 'Doonium', 'surowce', 'kua', 260, 't', 'Kuat'),
            $t('BRZ', 'Bronzium', 'surowce', 'crl', 180, 't', 'Corellia'),
            $t('ZBO', 'Zboże', 'żywność', 'cor', 20, 't', 'Agamar'),
            $t('NRF', 'Mięso nerfów', 'żywność', 'cor', 45, 't', 'Naboo'),
            $t('BCT', 'Bacta', 'medycyna', 'cor', 900, 'zbiornik', 'Thyferra', 0.03),
            $t('KOL', 'Kolto', 'medycyna', 'cor', 650, 'zbiornik', 'Manaan'),
            $t('HIP', 'Części hipernapędu', 'technika', 'crl', 950, 'kontener', 'Corellia'),
            $t('MDR', 'Moduły droidów', 'technika', 'cor', 300, 'skrzynia', 'Affa'),
            $t('BLS', 'Blastery bez numerów', 'broń', 'nar', 500, 'skrzynia', 'Nar Shaddaa', 0.035),
            $t('WIN', 'Wino koreliańskie', 'luksus', 'crl', 220, 'skrzynia', 'Corellia'),
            $t('JED', 'Jedwab hapański', 'luksus', 'cor', 380, 'bela', 'Hapes'),
            $t('GLT', 'Glitterstim', 'przyprawy', 'nar', 1500, 'kg', 'Kessel', 0.05),
            $t('RYL', 'Ryll', 'przyprawy', 'nar', 700, 'kg', 'Ryloth', 0.045),
        ],
        'ustawienia' => gielda_ustawienia_domyslne(),
    ];
}

function gielda_definicje(): array
{
    static $cache = null;
    if ($cache) return $cache;
    $g = wczytaj('gielda', null) ?? gielda_domyslna();
    $g['ustawienia'] = ($g['ustawienia'] ?? []) + gielda_ustawienia_domyslne();
    return $cache = $g;
}

// Planety, których dotyczy instrument: skąd pochodzi i gdzie jest notowany.
function gielda_obiekt(array $i, array $gieldy): array
{
    $pl = array_column($gieldy, 'planeta', 'id');
    return ['planety' => array_values(array_filter([$i['pochodzenie'] ?? '', $pl[$i['gielda']] ?? ''])),
        'rodzaj' => $i['rodzaj'], 'kategoria' => $i['kategoria'] ?? '', 'cele' => [$i['symbol'], $i['nazwa']]];
}

// Losowość z rozkładu normalnego wyznaczona przez symbol i dzień (Box–Muller).
function gielda_eps(string $symbol, string $dzien): float
{
    $u1 = (crc32('a|' . $symbol . '|' . $dzien) % 1000000 + 1) / 1000001;
    $u2 = (crc32('b|' . $symbol . '|' . $dzien) % 1000000) / 1000000;
    return max(-3.0, min(3.0, sqrt(-2 * log($u1)) * cos(2 * M_PI * $u2)));
}

function gielda_krok(float $poprzedni, array $i, array $g, string $dzien, ?array $wydarzenia = null): float
{
    $u = $g['ustawienia'];
    $w = wydarzenia_wplyw(gielda_obiekt($i, $g['gieldy']), $dzien, $wydarzenia);
    $f = max(0.01, (float) $i['cena']) * $w['mnoznik'];
    $sigma = (float) ($i['zmiennosc'] ?? ($i['rodzaj'] === 'towar' ? $u['zmiennosc_towar'] : $u['zmiennosc_spolka']));
    $x = log($poprzedni) + (float) $u['powrot'] * (log($f) - log($poprzedni)) + $sigma * $w['niepewnosc'] * gielda_eps($i['symbol'], $dzien);
    return round(max(0.01, exp($x)), 2);
}

// Dopisuje brakujące dni (do dziś) wszystkim instrumentom. Nowy instrument dostaje historię.
function gielda_dociagnij(): array
{
    $g = gielda_definicje();
    $dzis = date('Y-m-d');
    $not = wczytaj('gielda_notowania', []);
    $brak = false;
    foreach ($g['instrumenty'] as $i) {
        $n = $not[$i['symbol']] ?? null;
        if (!$n || date('Y-m-d', strtotime($n['od'] . ' +' . (count($n['c']) - 1) . ' days')) < $dzis) $brak = true;
    }
    if (!$brak) return $not;
    return zmien('gielda_notowania', function (&$not) use ($g, $dzis) {
        foreach ($g['instrumenty'] as $i) {
            $n = $not[$i['symbol']] ?? null;
            if (!$n) {
                $od = date('Y-m-d', strtotime($dzis . ' -' . max(30, (int) $g['ustawienia']['historia_dni']) . ' days'));
                $n = ['od' => $od, 'c' => [round((float) $i['cena'], 2)]];
            }
            $ostatni = date('Y-m-d', strtotime($n['od'] . ' +' . (count($n['c']) - 1) . ' days'));
            while ($ostatni < $dzis) {
                $ostatni = date('Y-m-d', strtotime($ostatni . ' +1 day'));
                $n['c'][] = gielda_krok((float) end($n['c']), $i, $g, $ostatni);
            }
            // Trzymamy najwyżej dwa lata.
            if (count($n['c']) > GIELDA_MAX_DNI) {
                $nadmiar = count($n['c']) - GIELDA_MAX_DNI;
                $n['c'] = array_slice($n['c'], $nadmiar);
                $n['od'] = date('Y-m-d', strtotime($n['od'] . " +$nadmiar days"));
            }
            $not[$i['symbol']] = $n;
        }
        return $not;
    }, []);
}

// Po zmianie wydarzeń dzisiejszy kurs liczy się od nowa (przy następnym wejściu na giełdę),
// więc wydarzenie zaczynające się dziś działa od razu. Historia sprzed dziś się nie zmienia.
function gielda_przelicz_dzis(): void
{
    $dzis = date('Y-m-d');
    zmien('gielda_notowania', function (&$not) use ($dzis) {
        foreach ($not as &$n) {
            if (count($n['c']) > 1 && date('Y-m-d', strtotime($n['od'] . ' +' . (count($n['c']) - 1) . ' days')) === $dzis) array_pop($n['c']);
        }
    }, []);
}

function gielda_instrument(string $symbol): ?array
{
    foreach (gielda_definicje()['instrumenty'] as $i) {
        if ($i['symbol'] === $symbol) return $i;
    }
    return null;
}

function gielda_portfel(array $portfele, string $uid): array
{
    return ($portfele[$uid] ?? []) + ['pozycje' => [], 'historia' => []];
}

// Walidacja definicji z panelu MG.
function gielda_z_wejscia(array $w): array
{
    $gieldy = [];
    foreach ((array) ($w['gieldy'] ?? []) as $x) {
        $id = mb_strtolower(trim((string) ($x['id'] ?? '')));
        if (!preg_match('/^[a-z0-9_-]{2,12}$/', $id)) blad('Giełda: identyfikator „' . $id . '” (2–12 małych liter lub cyfr).');
        if (isset($gieldy[$id])) blad("Giełda „{$id}” powtarza się.");
        $gieldy[$id] = ['id' => $id, 'nazwa' => mb_substr(trim((string) ($x['nazwa'] ?? $id)), 0, 80), 'planeta' => mb_substr(trim((string) ($x['planeta'] ?? '')), 0, 80)];
    }
    if (!$gieldy) blad('Potrzebna jest co najmniej jedna giełda.');
    $instrumenty = [];
    foreach ((array) ($w['instrumenty'] ?? []) as $x) {
        $sym = mb_strtoupper(trim((string) ($x['symbol'] ?? '')));
        if (!preg_match('/^[A-Z0-9]{2,6}$/', $sym)) blad("Symbol „{$sym}”: 2–6 wielkich liter lub cyfr.");
        if (isset($instrumenty[$sym])) blad("Symbol {$sym} powtarza się.");
        $rodzaj = ($x['rodzaj'] ?? '') === 'spolka' ? 'spolka' : 'towar';
        $gid = mb_strtolower(trim((string) ($x['gielda'] ?? '')));
        if (!isset($gieldy[$gid])) blad("{$sym}: nie ma giełdy „{$gid}”.");
        $cena = round((float) ($x['cena'] ?? 0), 2);
        if ($cena <= 0) blad("{$sym}: cena bazowa musi być większa od zera.");
        $instrumenty[$sym] = [
            'symbol' => $sym, 'nazwa' => mb_substr(trim((string) ($x['nazwa'] ?? $sym)), 0, 80), 'rodzaj' => $rodzaj,
            'kategoria' => mb_strtolower(mb_substr(trim((string) ($x['kategoria'] ?? '')), 0, 40)),
            'gielda' => $gid, 'cena' => $cena,
            'jednostka' => mb_substr(trim((string) ($x['jednostka'] ?? ($rodzaj === 'spolka' ? 'akcja' : 'szt.'))), 0, 20),
            'pochodzenie' => mb_substr(trim((string) ($x['pochodzenie'] ?? '')), 0, 80),
        ] + (isset($x['zmiennosc']) && $x['zmiennosc'] !== '' ? ['zmiennosc' => max(0.001, min(0.3, (float) $x['zmiennosc']))] : []);
    }
    $u = (array) ($w['ustawienia'] ?? []) + gielda_ustawienia_domyslne();
    $ust = [
        'powrot' => max(0.01, min(0.5, (float) $u['powrot'])),
        'zmiennosc_spolka' => max(0.001, min(0.3, (float) $u['zmiennosc_spolka'])),
        'zmiennosc_towar' => max(0.001, min(0.3, (float) $u['zmiennosc_towar'])),
        'prowizja' => max(0, min(0.1, (float) $u['prowizja'])),
        'historia_dni' => max(30, min(GIELDA_MAX_DNI, (int) $u['historia_dni'])),
    ];
    return ['gieldy' => array_values($gieldy), 'instrumenty' => array_values($instrumenty), 'ustawienia' => $ust];
}

function obsluz_gielda(string $akcja, bool $post): void
{
    switch ($akcja) {

        case 'gielda':
            $u = wymagaj_logowania();
            $g = gielda_definicje();
            $not = gielda_dociagnij();
            $lista = [];
            foreach ($g['instrumenty'] as $i) {
                $c = $not[$i['symbol']]['c'] ?? [(float) $i['cena']];
                $lista[] = array_diff_key($i, ['cena' => 1, 'zmiennosc' => 1]) + [
                    'kurs' => end($c), 'poprzedni' => $c[count($c) - 2] ?? end($c), 'seria' => array_slice($c, -30),
                ];
            }
            $portfel = gielda_portfel(wczytaj('gielda_portfele', []), $u['id']);
            $bank = wczytaj('bank', bank_pusty());
            odpowiedz([
                'dzien' => date('Y-m-d'), 'gieldy' => $g['gieldy'], 'instrumenty' => $lista, 'prowizja' => $g['ustawienia']['prowizja'],
                'portfel' => ['pozycje' => $portfel['pozycje'], 'historia' => array_slice(array_reverse($portfel['historia']), 0, 30)],
                'saldo' => $bank['konta'][$u['id']]['saldo'] ?? 0,
            ]);

        case 'gielda_notowania':
            wymagaj_logowania();
            $sym = (string) ($_GET['s'] ?? '');
            $dni = max(5, min(GIELDA_MAX_DNI, (int) ($_GET['dni'] ?? 90)));
            $n = gielda_dociagnij()[$sym] ?? null;
            if (!$n) blad('Brak notowań tego instrumentu.', 404);
            $c = array_slice($n['c'], -$dni);
            $od = date('Y-m-d', strtotime($n['od'] . ' +' . (count($n['c']) - count($c)) . ' days'));
            odpowiedz(['symbol' => $sym, 'od' => $od, 'ceny' => $c]);

        case 'gielda_transakcja':
            if (!$post) blad('Zła metoda.', 405);
            $u = wymagaj_logowania();
            $w = wejscie();
            $sym = (string) ($w['symbol'] ?? '');
            $typ = ($w['typ'] ?? '') === 'sprzedaj' ? 'sprzedaj' : 'kup';
            $ilosc = (int) ($w['ilosc'] ?? 0);
            if ($ilosc <= 0 || $ilosc > 1000000) blad('Podaj ilość większą od zera.');
            $i = gielda_instrument($sym) ?? blad('Ten instrument nie jest notowany.', 404);
            $c = gielda_dociagnij()[$sym]['c'];
            $kurs = (float) end($c);
            $wartosc = (int) round($kurs * $ilosc);
            $prowizja = max(1, (int) round($wartosc * (float) gielda_definicje()['ustawienia']['prowizja']));
            $wpis = zmien('gielda_portfele', function (&$portfele) use ($u, $i, $typ, $ilosc, $kurs, $wartosc, $prowizja) {
                $p = gielda_portfel($portfele, $u['id']);
                $poz = $p['pozycje'][$i['symbol']] ?? ['ilosc' => 0, 'koszt' => 0];
                $nazwy = bank_wlasciciele();
                $tytul = ($typ === 'kup' ? 'Kupno' : 'Sprzedaż') . " {$ilosc} × {$i['symbol']} po " . number_format($kurs, 2, ',', ' ') . ' kr';
                if ($typ === 'kup') {
                    zmien('bank', function (&$bank) use ($u, $wartosc, $prowizja, $tytul, $nazwy) {
                        bank_blad_przelewu(bank_obciaz($bank, $u['id'], $wartosc + $prowizja, 'CDEX — rozliczenia giełdowe', $tytul, $nazwy));
                    }, bank_pusty());
                    $poz = ['ilosc' => $poz['ilosc'] + $ilosc, 'koszt' => $poz['koszt'] + $wartosc + $prowizja];
                } else {
                    if ($ilosc > $poz['ilosc']) blad("W portfelu masz tylko {$poz['ilosc']} × {$i['symbol']}.");
                    zmien('bank', function (&$bank) use ($u, $wartosc, $prowizja, $tytul, $nazwy) {
                        bank_uznaj($bank, $u['id'], max(0, $wartosc - $prowizja), 'CDEX — rozliczenia giełdowe', $tytul, $nazwy);
                    }, bank_pusty());
                    // Koszt pozostałych jednostek maleje proporcjonalnie (średnia cena zakupu bez zmian).
                    $koszt = $poz['ilosc'] ? (int) round($poz['koszt'] * ($poz['ilosc'] - $ilosc) / $poz['ilosc']) : 0;
                    $poz = ['ilosc' => $poz['ilosc'] - $ilosc, 'koszt' => $koszt];
                }
                if ($poz['ilosc'] > 0) $p['pozycje'][$i['symbol']] = $poz;
                else unset($p['pozycje'][$i['symbol']]);
                $wpis = ['data' => date('c'), 'typ' => $typ, 'symbol' => $i['symbol'], 'ilosc' => $ilosc, 'kurs' => $kurs, 'wartosc' => $wartosc, 'prowizja' => $prowizja];
                $p['historia'] = array_slice([...$p['historia'], $wpis], -GIELDA_HISTORIA_TRANSAKCJI);
                $portfele[$u['id']] = $p;
                return $wpis;
            }, []);
            odpowiedz(['ok' => true, 'transakcja' => $wpis]);

        // ----- panel MG -----

        case 'mg_gielda':
            wymagaj_mg();
            $g = gielda_definicje();
            $not = gielda_dociagnij();
            $kursy = array_map(fn($n) => end($n['c']), $not);
            $postacie = bank_postacie();
            $portfele = [];
            foreach (wczytaj('gielda_portfele', []) as $uid => $p) {
                $wartosc = 0;
                foreach ($p['pozycje'] ?? [] as $sym => $poz) $wartosc += (int) round(($kursy[$sym] ?? 0) * $poz['ilosc']);
                if ($p['pozycje'] ?? []) $portfele[] = ['postac' => $postacie[$uid] ?? '?', 'pozycje' => $p['pozycje'], 'wartosc' => $wartosc];
            }
            odpowiedz(['gielda' => ['gieldy' => $g['gieldy'], 'instrumenty' => $g['instrumenty'], 'ustawienia' => $g['ustawienia']], 'kursy' => $kursy, 'portfele' => $portfele]);

        case 'mg_gielda_zapisz':
            if (!$post) blad('Zła metoda.', 405);
            wymagaj_mg();
            $nowa = gielda_z_wejscia(wejscie());
            $symbole = array_column($nowa['instrumenty'], 'symbol');
            foreach (wczytaj('gielda_portfele', []) as $p) {
                foreach (array_keys($p['pozycje'] ?? []) as $sym) {
                    if (!in_array($sym, $symbole, true)) blad("Nie można usunąć {$sym}: gracze mają go w portfelach.");
                }
            }
            zmien('gielda', function (&$g) use ($nowa) {
                $g = $nowa;
            }, []);
            odpowiedz(['ok' => true]);

        case 'mg_gielda_podglad':
            // Historia i prognoza kursu na podstawie zapisanych wydarzeń, z opcjonalną podmianą
            // jednego wydarzenia (szkic z formularza) — bez zapisywania czegokolwiek.
            if (!$post) blad('Zła metoda.', 405);
            wymagaj_mg();
            $w = wejscie();
            $sym = (string) ($w['symbol'] ?? '');
            $i = gielda_instrument($sym) ?? blad('Nie ma takiego instrumentu.', 404);
            $dni = max(1, min(180, (int) ($w['dni'] ?? 60)));
            $lista = wydarzenia_lista();
            if (!empty($w['szkic'])) {
                $szkic = wydarzenie_z_wejscia($w['szkic']);
                $lista = array_values(array_filter($lista, fn($x) => $x['id'] !== $szkic['id']));
                $lista[] = $szkic;
            }
            $n = gielda_dociagnij()[$sym];
            $historia = array_slice($n['c'], -120);
            $g = gielda_definicje();
            $kurs = (float) end($n['c']);
            $dzien = date('Y-m-d');
            $prognoza = [];
            $bez = [];
            $kursBez = $kurs;
            for ($k = 1; $k <= $dni; $k++) {
                $dzien = date('Y-m-d', strtotime($dzien . ' +1 day'));
                $kurs = gielda_krok($kurs, $i, $g, $dzien, $lista);
                $kursBez = gielda_krok($kursBez, $i, $g, $dzien, []);
                $prognoza[] = $kurs;
                $bez[] = $kursBez;
            }
            odpowiedz(['historia' => $historia, 'prognoza' => $prognoza, 'bez_wydarzen' => $bez, 'dzis' => date('Y-m-d')]);

        case 'mg_gielda_przelicz':
            // Od nowa cała historia (np. po dużej zmianie cen bazowych). Portfele zostają.
            if (!$post) blad('Zła metoda.', 405);
            wymagaj_mg();
            zmien('gielda_notowania', function (&$n) {
                $n = [];
            }, []);
            gielda_dociagnij();
            odpowiedz(['ok' => true]);
    }
}
