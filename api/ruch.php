<?php
// Przemieszczanie się po planecie, przygotowanie statku do lotu, gotówka (bankomat, sklep).
//
// LOKACJE. Katalog „lokacje”: miejsca na planetach z lokalnymi współrzędnymi w km (x, y),
// typem (hangar, hotel, bankomat, sklep, kantyna, biuro, garaz, port, inne), opcjonalnie
// jakością obsługi (hangar 1–5), zapasem paliwa, ofertą sklepu. Budynki firm z x, y też są
// lokacjami. Gracz zna: lokacje publiczne, budynki swoich firm i „znane miejsca” z karty.
//
// CZAS. Podróże liczone są w minutach świata gry. Licznik na tablecie biegnie szybciej:
// „tempo” (ustawienie MG) to liczba sekund rzeczywistych na minutę świata (domyślnie 1).
//
// KLUCZE LOKACJI: l:<id> (katalog), b:<id firmy>:<id budynku>, s:<id firmy>:<id statku> (pokład).

declare(strict_types=1);

const PIESZO_KMH = 5;
const TAKSOWKI = [
    'wysoka' => ['czekanie' => 3, 'kmh' => 120, 'stawka' => 4],
    'niska' => ['czekanie' => 20, 'kmh' => 90, 'stawka' => 6],
];
const TYPY_LOKACJI = ['hangar', 'port', 'hotel', 'bankomat', 'sklep', 'kantyna', 'biuro', 'garaz', 'inne'];

// Klucz lokacji z nazwy albo klucza (dla edytorów MG). Pusty tekst = brak lokacji.
function ruch_klucz(array $lokacje, string $wartosc): string
{
    $wartosc = trim($wartosc);
    if ($wartosc === '') return '';
    if (isset($lokacje[$wartosc])) return $wartosc;
    foreach ($lokacje as $k => $l) {
        if (mb_strtolower($l['nazwa']) === mb_strtolower($wartosc)) return $k;
    }
    blad("Nieznana lokacja: „{$wartosc}”. Dodaj ją w katalogu (lokacje) albo nadaj budynkowi x i y.");
}

function ruch_tempo(): float
{
    return max(0.05, min(60, (float) (wczytaj('katalog', [])['ustawienia']['tempo'] ?? 1)));
}

// Wszystkie lokacje (katalog + budynki firm), klucz => dane.
function ruch_lokacje(): array
{
    $l = [];
    foreach (wczytaj('katalog', [])['lokacje'] ?? [] as $x) {
        $l['l:' . $x['id']] = $x + ['klucz' => 'l:' . $x['id']];
    }
    foreach (wczytaj('firmy', ['firmy' => []])['firmy'] as $f) {
        foreach ($f['dane']['budynki'] ?? [] as $b) {
            if (!isset($b['x'], $b['y']) || ($b['planeta'] ?? '') === '') continue;
            $typ = mb_strtolower($b['typ'] ?? '');
            $l['b:' . $f['id'] . ':' . $b['id']] = [
                'klucz' => 'b:' . $f['id'] . ':' . $b['id'], 'nazwa' => $b['nazwa'], 'planeta' => $b['planeta'],
                'typ' => in_array($typ, TYPY_LOKACJI, true) ? $typ : 'biuro', 'x' => (float) $b['x'], 'y' => (float) $b['y'],
                'publiczna' => false, 'firma' => $f['id'], 'jakosc' => (int) ($b['jakosc'] ?? 3), 'paliwo' => $b['paliwo'] ?? null,
                'opis' => $b['opis'] ?? '',
            ];
        }
    }
    return $l;
}

function ruch_odleglosc(array $a, array $b): float
{
    return hypot((float) $a['x'] - (float) $b['x'], (float) $a['y'] - (float) $b['y']);
}

// Firmy, w których postać jest członkiem: id => firma.
function ruch_moje_firmy(string $uid): array
{
    $w = [];
    foreach (wczytaj('firmy', ['firmy' => []])['firmy'] as $f) {
        foreach ($f['czlonkowie'] as $c) {
            if ($c['uid'] === $uid) $w[$f['id']] = $f;
        }
    }
    return $w;
}

// Gdzie jest postać: lokacja (jeśli znana) i współrzędne.
function ruch_gdzie(array $karta, array $lokacje): ?array
{
    $p = $karta['pozycja'];
    $klucz = $p['lokacja'] ?? '';
    if (str_starts_with($klucz, 's:')) {
        // Na pokładzie statku: pozycja = hangar statku.
        [, $fid, $sid] = explode(':', $klucz) + ['', '', ''];
        foreach (wczytaj('firmy', ['firmy' => []])['firmy'] as $f) {
            if ($f['id'] !== $fid) continue;
            foreach ($f['dane']['flota'] as $s) {
                if ($s['id'] === $sid && isset($lokacje[$s['hangar'] ?? ''])) {
                    return ['klucz' => $klucz, 'nazwa' => 'Pokład: ' . $s['nazwa'], 'typ' => 'poklad'] + array_intersect_key($lokacje[$s['hangar']], ['x' => 1, 'y' => 1, 'planeta' => 1]);
                }
            }
        }
        return null;
    }
    if ($klucz !== '' && isset($lokacje[$klucz])) return $lokacje[$klucz];
    if (($p['planeta'] ?? '') !== '' && is_numeric($p['x'] ?? null) && is_numeric($p['y'] ?? null)) {
        return ['klucz' => '', 'nazwa' => $p['miejsce'] ?: 'Nieoznaczone miejsce', 'typ' => 'inne', 'x' => (float) $p['x'], 'y' => (float) $p['y'], 'planeta' => $p['planeta']];
    }
    return null;
}

// Miejsca, które postać zna na danej planecie.
function ruch_znane(string $uid, array $karta, array $lokacje, string $planeta): array
{
    $firmy = array_keys(ruch_moje_firmy($uid));
    $znane = array_map('mb_strtolower', $karta['znane'] ?? []);
    return array_filter($lokacje, fn($l) => ($l['planeta'] ?? '') === $planeta && (
        !empty($l['publiczna'])
        || (isset($l['firma']) && in_array($l['firma'], $firmy, true))
        || in_array(mb_strtolower($l['nazwa']), $znane, true)
        || in_array($l['klucz'], $karta['znane'] ?? [], true)
    ));
}

// Pojazdy dostępne dla postaci: prywatne (karta) i firmowe (każdy członek może ich użyć).
function ruch_pojazdy(string $uid, array $karta, array $lokacje): array
{
    $w = [];
    foreach ($karta['pojazdy'] ?? [] as $i => $p) {
        $w['k:' . $i] = $p + ['klucz' => 'k:' . $i, 'wlasciciel' => 'prywatny', 'kierowca_staty' => null];
    }
    foreach (ruch_moje_firmy($uid) as $f) {
        $zaloga = array_column($f['dane']['zaloga'] ?? [], null, 'id');
        foreach ($f['dane']['pojazdy'] ?? [] as $p) {
            $k = $zaloga[$p['kierowca'] ?? ''] ?? null;
            $w['f:' . $f['id'] . ':' . $p['id']] = $p + ['klucz' => 'f:' . $f['id'] . ':' . $p['id'], 'wlasciciel' => $f['nazwa'],
                'kierowca_imie' => $k['imie'] ?? '', 'kierowca_staty' => $k ? (int) ($k['statystyki']['pilotaz'] ?? 5) : null];
        }
    }
    foreach ($w as &$p) {
        $p['gdzie'] = $lokacje[$p['lokacja'] ?? ''] ?? null;
    }
    return $w;
}

// Pilotaż postaci z karty (umiejętność zawierająca „pilot”), 0–5.
function ruch_pilotaz_gracza(array $karta): int
{
    foreach ($karta['statystyki']['umiejetnosci'] ?? [] as $n => $v) {
        if (str_contains(mb_strtolower((string) $n), 'pilot')) return max(0, min(5, (int) $v));
    }
    return 0;
}

// Opcje dotarcia do celu. Czasy w minutach świata gry.
function ruch_opcje(string $uid, array $karta, array $skad, array $cel, array $planeta, array $lokacje): array
{
    $d = ruch_odleglosc($skad, $cel);
    $op = [];
    $op[] = ['srodek' => 'pieszo', 'nazwa' => 'Pieszo', 'minuty' => (int) ceil($d / PIESZO_KMH * 60), 'koszt' => 0, 'opis' => sprintf('%.1f km', $d)];
    $urb = $planeta['urbanizacja'] ?? 'brak';
    if (isset(TAKSOWKI[$urb])) {
        $t = TAKSOWKI[$urb];
        $stawka = (int) ($planeta['taksowka'] ?? $t['stawka']);
        $op[] = ['srodek' => 'taksowka', 'nazwa' => 'Taksówka', 'minuty' => (int) ceil($t['czekanie'] + $d / $t['kmh'] * 60),
            'koszt' => (int) ceil(10 + $stawka * $d), 'opis' => "podstawienie ok. {$t['czekanie']} min"];
    }
    foreach (ruch_pojazdy($uid, $karta, $lokacje) as $p) {
        if (!$p['gdzie'] || ($p['gdzie']['planeta'] ?? '') !== ($cel['planeta'] ?? '')) continue;
        $dojscie = ruch_odleglosc($skad, $p['gdzie']);
        $kmh = max(10, (int) ($p['predkosc'] ?? 200));
        $nazwa = $p['nazwa'] . ($p['wlasciciel'] !== 'prywatny' ? ' (' . $p['wlasciciel'] . ')' : '');
        $dojscieMin = (int) ceil($dojscie / PIESZO_KMH * 60);
        $opisDojscia = $dojscie > 0.05 ? sprintf('najpierw %d min pieszo do: %s · ', $dojscieMin, $p['gdzie']['nazwa']) : '';
        // Sam: Pilotaż z karty (0 → wolno i ostrożnie, 5 → szybko).
        $sam = 1.3 - 0.1 * ruch_pilotaz_gracza($karta);
        $op[] = ['srodek' => 'pojazd', 'pojazd' => $p['klucz'], 'kierowca' => false, 'nazwa' => $nazwa . ' — prowadzisz sam',
            'minuty' => $dojscieMin + (int) ceil(ruch_odleglosc($p['gdzie'], $cel) / $kmh * 60 * $sam), 'koszt' => 0, 'opis' => $opisDojscia . "$kmh km/h"];
        if ($p['kierowca_staty'] !== null) {
            // Z kierowcą: jego ukryty pilotaż (1–10).
            $mod = 1.25 - 0.05 * $p['kierowca_staty'];
            $op[] = ['srodek' => 'pojazd', 'pojazd' => $p['klucz'], 'kierowca' => true, 'nazwa' => $nazwa . ' — kierowca: ' . $p['kierowca_imie'],
                'minuty' => $dojscieMin + (int) ceil(ruch_odleglosc($p['gdzie'], $cel) / $kmh * 60 * $mod), 'koszt' => 0, 'opis' => $opisDojscia . "$kmh km/h"];
        }
    }
    usort($op, fn($a, $b) => $a['minuty'] <=> $b['minuty']);
    return $op;
}

// Kończy podróż, jeśli minął czas. Wywoływane przy każdym odczycie nawigacji i karty.
function ruch_dokoncz(string $uid): void
{
    $k = wczytaj('karty', [])[$uid]['podroz'] ?? null;
    if (!$k || time() < (int) $k['koniec']) return;
    zmien('karty', function (&$karty) use ($uid) {
        $p = $karty[$uid]['podroz'] ?? null;
        if (!$p || time() < (int) $p['koniec']) return;
        $karty[$uid]['pozycja'] = array_merge($karty[$uid]['pozycja'] ?? [], [
            'lokacja' => $p['cel'], 'miejsce' => $p['cel_nazwa'], 'planeta' => $p['planeta'],
            'budynek' => str_starts_with($p['cel'], 'b:') ? substr($p['cel'], 2) : '',
        ]);
        unset($karty[$uid]['podroz']);
    });
}

function ruch_planeta(string $id): array
{
    foreach (katalog()['planety'] as $p) {
        if ($p['id'] === $id) return $p;
    }
    return ['id' => '', 'nazwa' => '?'];
}

// Statki z firm postaci, które stoją na tej planecie w znanym hangarze.
function ruch_statki(string $uid, string $planeta, array $lokacje): array
{
    $w = [];
    foreach (ruch_moje_firmy($uid) as $f) {
        foreach ($f['dane']['flota'] ?? [] as $s) {
            if (($s['lokalizacja'] ?? '') !== $planeta || !isset($lokacje[$s['hangar'] ?? ''])) continue;
            $w[] = ['klucz' => $f['id'] . ':' . $s['id'], 'firma' => $f['nazwa'], 'nazwa' => $s['nazwa'], 'klasa' => $s['klasa'] ?? '',
                'stan' => $s['stan'] ?? 'sprawny', 'paliwo' => (int) ($s['paliwo'] ?? 100), 'hangar' => $lokacje[$s['hangar']],
                'przygotowanie' => $s['przygotowanie'] ?? null];
        }
    }
    return $w;
}

// Czas obsługi naziemnej (minuty świata): jakość hangaru + tankowanie + ewentualny dowóz paliwa.
function ruch_obsluga(array $statek, array $hangar): array
{
    $jakosc = max(1, min(5, (int) ($hangar['jakosc'] ?? 3)));
    $baza = [1 => 180, 2 => 120, 3 => 90, 4 => 60, 5 => 40][$jakosc];
    $brak = max(0, 100 - (int) ($statek['paliwo'] ?? 100));
    $tankowanie = (int) ceil($brak * 0.6);
    $zapas = $hangar['paliwo'] ?? null; // null = bez ograniczeń
    $dowoz = $zapas !== null && (int) $zapas < $brak ? 120 : 0;
    $cena = (int) ($hangar['cena_paliwa'] ?? 15);
    return ['minuty' => $baza + $tankowanie + $dowoz, 'baza' => $baza, 'tankowanie' => $tankowanie, 'dowoz' => $dowoz,
        'brak' => $brak, 'koszt' => $brak * $cena, 'jakosc' => $jakosc];
}

const AKCJE_RUCHU = ['nawigacja', 'trasa', 'podroz', 'bankomat', 'sklep_kup', 'statek_przygotuj', 'na_poklad', 'zejdz_z_pokladu'];

function obsluz_ruch(string $akcja, bool $post): void
{
    // Każda akcja najpierw domyka podróż, która w międzyczasie dobiegła końca.
    if (in_array($akcja, AKCJE_RUCHU, true) && ($ja = ja())) ruch_dokoncz($ja['id']);
    switch ($akcja) {

        case 'nawigacja':
            $u = wymagaj_logowania();
            ruch_dokoncz($u['id']);
            $karta = karta($u['id']);
            $lok = ruch_lokacje();
            $gdzie = ruch_gdzie($karta, $lok);
            $bank = wczytaj('bank', ['konta' => []]);
            $wynik = [
                'tempo' => ruch_tempo(), 'gotowka' => (int) ($karta['gotowka'] ?? 0), 'saldo' => $bank['konta'][$u['id']]['saldo'] ?? 0,
                'podroz' => $karta['podroz'] ?? null, 'teraz' => time(), 'gdzie' => $gdzie, 'planeta' => null, 'miejsca' => [], 'statki' => [], 'pojazdy' => [],
            ];
            if ($gdzie) {
                $pl = ruch_planeta($gdzie['planeta']);
                $wynik['planeta'] = ['nazwa' => $pl['nazwa'], 'urbanizacja' => $pl['urbanizacja'] ?? 'brak'];
                foreach (ruch_znane($u['id'], $karta, $lok, $gdzie['planeta']) as $l) {
                    if ($l['klucz'] === ($gdzie['klucz'] ?? '')) continue;
                    $wynik['miejsca'][] = ['klucz' => $l['klucz'], 'nazwa' => $l['nazwa'], 'typ' => $l['typ'], 'km' => round(ruch_odleglosc($gdzie, $l), 1), 'opis' => $l['opis'] ?? ''];
                }
                usort($wynik['miejsca'], fn($a, $b) => $a['km'] <=> $b['km']);
                foreach (ruch_statki($u['id'], $gdzie['planeta'], $lok) as $s) {
                    $s['obsluga'] = ruch_obsluga(['paliwo' => $s['paliwo']], $s['hangar']);
                    $s['km'] = round(ruch_odleglosc($gdzie, $s['hangar']), 1);
                    $s['na_miejscu'] = ($gdzie['klucz'] ?? '') === $s['hangar']['klucz'];
                    $s['hangar'] = ['klucz' => $s['hangar']['klucz'], 'nazwa' => $s['hangar']['nazwa'], 'jakosc' => (int) ($s['hangar']['jakosc'] ?? 3)];
                    $wynik['statki'][] = $s;
                }
                foreach (ruch_pojazdy($u['id'], $karta, $lok) as $p) {
                    $wynik['pojazdy'][] = ['nazwa' => $p['nazwa'], 'typ' => $p['typ'] ?? '', 'predkosc' => $p['predkosc'] ?? 0, 'wlasciciel' => $p['wlasciciel'],
                        'kierowca' => $p['kierowca_imie'] ?? '', 'gdzie' => $p['gdzie']['nazwa'] ?? 'nieznane', 'km' => $p['gdzie'] && $p['gdzie']['planeta'] === $gdzie['planeta'] ? round(ruch_odleglosc($gdzie, $p['gdzie']), 1) : null];
                }
                // Akcje w miejscu: bankomat, sklep.
                if (($gdzie['typ'] ?? '') === 'sklep') $wynik['sklep'] = $gdzie['oferta'] ?? [];
                $wynik['bankomat'] = ($gdzie['typ'] ?? '') === 'bankomat';
            }
            odpowiedz($wynik);

        case 'trasa':
            $u = wymagaj_logowania();
            $karta = karta($u['id']);
            $lok = ruch_lokacje();
            $gdzie = ruch_gdzie($karta, $lok);
            $cel = $lok[(string) ($_GET['cel'] ?? '')] ?? null;
            if (!$gdzie || !$cel || $cel['planeta'] !== $gdzie['planeta']) blad('Nie można wyznaczyć trasy.', 404);
            odpowiedz(['opcje' => ruch_opcje($u['id'], $karta, $gdzie, $cel, ruch_planeta($gdzie['planeta']), $lok)]);

        case 'podroz':
            if (!$post) blad('Zła metoda.', 405);
            $u = wymagaj_logowania();
            ruch_dokoncz($u['id']);
            $w = wejscie();
            $karta = karta($u['id']);
            if (!empty($karta['podroz'])) blad('Jesteś w drodze.');
            $lok = ruch_lokacje();
            $gdzie = ruch_gdzie($karta, $lok);
            $cel = $lok[(string) ($w['cel'] ?? '')] ?? null;
            if (!$gdzie || !$cel || $cel['planeta'] !== $gdzie['planeta']) blad('Nie można wyznaczyć trasy.');
            if (!isset(ruch_znane($u['id'], $karta, $lok, $gdzie['planeta'])[$cel['klucz']])) blad('Nie znasz tego miejsca.');
            $opcje = ruch_opcje($u['id'], $karta, $gdzie, $cel, ruch_planeta($gdzie['planeta']), $lok);
            $wybor = null;
            foreach ($opcje as $o) {
                if ($o['srodek'] === ($w['srodek'] ?? '') && ($o['pojazd'] ?? '') === ($w['pojazd'] ?? '') && (bool) ($o['kierowca'] ?? false) === !empty($w['kierowca'])) $wybor = $o;
            }
            if (!$wybor) blad('Ten środek transportu jest niedostępny.');
            // Opłata (taksówka): kartą albo gotówką.
            if ($wybor['koszt'] > 0) {
                if (($w['platnosc'] ?? 'karta') === 'gotowka') {
                    $ok = zmien('karty', function (&$k) use ($u, $wybor) {
                        if ((int) ($k[$u['id']]['gotowka'] ?? 0) < $wybor['koszt']) return false;
                        $k[$u['id']]['gotowka'] -= $wybor['koszt'];
                        return true;
                    });
                    if (!$ok) blad('Za mało gotówki.');
                } else {
                    $wyn = zmien('bank', fn(&$bank) => bank_obciaz($bank, $u['id'], $wybor['koszt'], 'Korporacja Przewozowa', 'Przejazd: ' . $cel['nazwa'], bank_wlasciciele()), bank_pusty());
                    if ($wyn !== 'ok') blad('Karta odrzucona: brak środków.');
                }
            }
            $sekundy = max(3, (int) round($wybor['minuty'] * ruch_tempo()));
            zmien('karty', function (&$k) use ($u, $cel, $wybor, $sekundy) {
                $k[$u['id']]['podroz'] = [
                    'cel' => $cel['klucz'], 'cel_nazwa' => $cel['nazwa'], 'planeta' => $cel['planeta'],
                    'srodek' => $wybor['nazwa'], 'minuty' => $wybor['minuty'], 'start' => time(), 'koniec' => time() + $sekundy,
                ];
            });
            // Pojazd jedzie razem z postacią.
            if (($wybor['pojazd'] ?? '') !== '') {
                $pk = $wybor['pojazd'];
                if (str_starts_with($pk, 'k:')) {
                    zmien('karty', function (&$k) use ($u, $pk, $cel) {
                        $k[$u['id']]['pojazdy'][(int) substr($pk, 2)]['lokacja'] = $cel['klucz'];
                    });
                } else {
                    [, $fid, $pid] = explode(':', $pk);
                    zmien('firmy', function (&$wsz) use ($fid, $pid, $cel) {
                        foreach ($wsz['firmy'] as &$f) {
                            if ($f['id'] !== $fid) continue;
                            foreach ($f['dane']['pojazdy'] as &$p) {
                                if ($p['id'] === $pid) $p['lokacja'] = $cel['klucz'];
                            }
                        }
                    }, ['firmy' => []]);
                }
            }
            odpowiedz(['ok' => true, 'sekundy' => $sekundy, 'minuty' => $wybor['minuty']]);

        case 'bankomat':
            // Wypłata (kwota > 0) albo wpłata (kwota < 0) gotówki. Tylko przy bankomacie.
            if (!$post) blad('Zła metoda.', 405);
            $u = wymagaj_logowania();
            $karta = karta($u['id']);
            $gdzie = ruch_gdzie($karta, ruch_lokacje());
            if (($gdzie['typ'] ?? '') !== 'bankomat') blad('W pobliżu nie ma bankomatu.');
            $kwota = bank_kwota(wejscie()['kwota'] ?? null);
            if ($kwota === 0) blad('Podaj kwotę.');
            if ($kwota > 0) {
                $wyn = zmien('bank', fn(&$bank) => bank_obciaz($bank, $u['id'], $kwota, 'Bankomat: ' . $gdzie['nazwa'], 'Wypłata gotówki', bank_wlasciciele()), bank_pusty());
                if ($wyn !== 'ok') blad('Niewystarczające środki na rachunku.');
                zmien('karty', function (&$k) use ($u, $kwota) { $k[$u['id']]['gotowka'] = (int) ($k[$u['id']]['gotowka'] ?? 0) + $kwota; });
            } else {
                $ok = zmien('karty', function (&$k) use ($u, $kwota) {
                    if ((int) ($k[$u['id']]['gotowka'] ?? 0) < -$kwota) return false;
                    $k[$u['id']]['gotowka'] += $kwota;
                    return true;
                });
                if (!$ok) blad('Nie masz tyle gotówki.');
                zmien('bank', fn(&$bank) => bank_uznaj($bank, $u['id'], -$kwota, 'Bankomat: ' . $gdzie['nazwa'], 'Wpłata gotówki', bank_wlasciciele()), bank_pusty());
            }
            odpowiedz(['ok' => true]);

        case 'sklep_kup':
            if (!$post) blad('Zła metoda.', 405);
            $u = wymagaj_logowania();
            $w = wejscie();
            $karta = karta($u['id']);
            $gdzie = ruch_gdzie($karta, ruch_lokacje());
            $towar = ($gdzie['oferta'] ?? [])[(int) ($w['pozycja'] ?? -1)] ?? null;
            if (($gdzie['typ'] ?? '') !== 'sklep' || !$towar) blad('Tego tu nie sprzedają.');
            $cena = max(0, (int) $towar['cena']);
            if (($w['platnosc'] ?? 'karta') === 'gotowka') {
                $ok = zmien('karty', function (&$k) use ($u, $cena) {
                    if ((int) ($k[$u['id']]['gotowka'] ?? 0) < $cena) return false;
                    $k[$u['id']]['gotowka'] -= $cena;
                    return true;
                });
                if (!$ok) blad('Za mało gotówki.');
            } else {
                $wyn = zmien('bank', fn(&$bank) => bank_obciaz($bank, $u['id'], $cena, $gdzie['nazwa'], 'Zakup: ' . $towar['nazwa'], bank_wlasciciele()), bank_pusty());
                if ($wyn !== 'ok') blad('Karta odrzucona: brak środków.');
            }
            zmien('karty', function (&$k) use ($u, $towar, $gdzie) {
                $k[$u['id']]['ekwipunek'][] = ['nazwa' => $towar['nazwa'], 'opis' => 'kupione: ' . $gdzie['nazwa']];
            });
            odpowiedz(['ok' => true]);

        case 'statek_przygotuj':
            // Obsługa naziemna: firma płaci za paliwo, hangar tankuje i sprawdza statek.
            if (!$post) blad('Zła metoda.', 405);
            $u = wymagaj_logowania();
            [$fid, $sid] = explode(':', (string) (wejscie()['statek'] ?? '')) + ['', ''];
            $firma = ruch_moje_firmy($u['id'])[$fid] ?? null;
            if (!$firma) blad('To nie jest statek twojej firmy.', 403);
            $lok = ruch_lokacje();
            $wynik = zmien('firmy', function (&$wsz) use ($fid, $sid, $lok, $firma) {
                foreach ($wsz['firmy'] as &$f) {
                    if ($f['id'] !== $fid) continue;
                    foreach ($f['dane']['flota'] as &$s) {
                        if ($s['id'] !== $sid) continue;
                        if (($s['stan'] ?? 'sprawny') !== 'sprawny') blad("Statek nie jest sprawny ({$s['stan']}).");
                        if (!empty($s['przygotowanie']) && time() < $s['przygotowanie']['gotowy']) blad('Obsługa naziemna już trwa.');
                        $hangar = $lok[$s['hangar'] ?? ''] ?? null;
                        if (!$hangar) blad('Statek nie stoi w żadnym hangarze.');
                        $o = ruch_obsluga($s, $hangar);
                        if ($o['koszt'] > 0) {
                            $klucz = 'f:' . $fid;
                            $wyn = zmien('bank', fn(&$bank) => bank_obciaz($bank, $klucz, $o['koszt'], $hangar['nazwa'], 'Paliwo i obsługa: ' . $s['nazwa'], bank_wlasciciele() + [$klucz => $firma['nazwa']]), bank_pusty());
                            if ($wyn !== 'ok') blad('Rachunek firmy nie pokrywa kosztu paliwa (' . $o['koszt'] . ' kr).');
                        }
                        $s['paliwo'] = 100;
                        $s['przygotowanie'] = ['start' => time(), 'gotowy' => time() + max(3, (int) round($o['minuty'] * ruch_tempo())), 'minuty' => $o['minuty']];
                        return $o + ['gotowy' => $s['przygotowanie']['gotowy']];
                    }
                }
                blad('Nie ma takiego statku.', 404);
            }, ['firmy' => []]);
            odpowiedz(['ok' => true] + $wynik);

        case 'na_poklad':
            if (!$post) blad('Zła metoda.', 405);
            $u = wymagaj_logowania();
            ruch_dokoncz($u['id']);
            $karta = karta($u['id']);
            $lok = ruch_lokacje();
            $gdzie = ruch_gdzie($karta, $lok);
            $klucz = (string) (wejscie()['statek'] ?? '');
            foreach (ruch_statki($u['id'], $gdzie['planeta'] ?? '', $lok) as $s) {
                if ($s['klucz'] !== $klucz) continue;
                if (($gdzie['klucz'] ?? '') !== $s['hangar']['klucz']) blad('Najpierw dotrzyj do hangaru: ' . $s['hangar']['nazwa'] . '.');
                if (empty($s['przygotowanie']) || time() < $s['przygotowanie']['gotowy']) blad('Obsługa naziemna jeszcze trwa.');
                zmien('karty', function (&$k) use ($u, $s) {
                    $k[$u['id']]['pozycja']['lokacja'] = 's:' . $s['klucz'];
                    $k[$u['id']]['pozycja']['miejsce'] = 'Pokład: ' . $s['nazwa'];
                });
                odpowiedz(['ok' => true]);
            }
            blad('Nie ma takiego statku w pobliżu.', 404);

        case 'zejdz_z_pokladu':
            if (!$post) blad('Zła metoda.', 405);
            $u = wymagaj_logowania();
            $karta = karta($u['id']);
            $lok = ruch_lokacje();
            $p = $karta['pozycja']['lokacja'] ?? '';
            if (!str_starts_with($p, 's:')) blad('Nie jesteś na pokładzie.');
            [, $fid, $sid] = explode(':', $p);
            foreach (ruch_statki($u['id'], ruch_gdzie($karta, $lok)['planeta'] ?? '', $lok) as $s) {
                if ($s['klucz'] === "$fid:$sid") {
                    zmien('karty', function (&$k) use ($u, $s) {
                        $k[$u['id']]['pozycja']['lokacja'] = $s['hangar']['klucz'];
                        $k[$u['id']]['pozycja']['miejsce'] = $s['hangar']['nazwa'];
                    });
                    odpowiedz(['ok' => true]);
                }
            }
            blad('Statek nie stoi w hangarze.');
    }
}
