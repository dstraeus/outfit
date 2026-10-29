# Outfit

Schlichte Web-App (PWA) fürs iPhone: Kleidung fotografieren, die App erkennt Art und Farbe
und schlägt passende Outfits vor (Wetter, Layering, Farbharmonie nach Sanzo Wada, Abwechslung, deine 👍/👎).

Der Startbildschirm zeigt nur das Outfit des Tages (👍 / 👎 / Anderes / Anziehen). Kleidung hinzufügen,
Schrank und Temperatur liegen im Menü ☰. Beim ersten Start erklärt die App, welche Teile noch fehlen.
Alles bleibt lokal auf dem Handy, kein Build-Schritt, keine Abhängigkeiten.

## Aufs iPhone bringen

Die App braucht eine HTTPS-Adresse (für Offline-Modus und Standort). Kostenlos über GitHub Pages:

1. Auf github.com ein neues öffentliches Repository anlegen, z. B. `outfit`.
2. Den Inhalt dieses Ordners hochladen („Add file → Upload files“, alle Dateien inkl. `js/`).
3. Repository → Settings → Pages → Branch `main`, Ordner `/ (root)` → Save.
4. Nach ca. 1 Minute auf dem iPhone in **Safari** `https://<dein-name>.github.io/outfit/` öffnen.
5. Teilen-Symbol → **Zum Home-Bildschirm**. Ab jetzt wie eine App starten.

Beim ersten Foto lädt die Bilderkennung einmalig ca. 150 MB (am besten im WLAN), danach funktioniert sie offline.

## Lokal testen

```bash
python -m http.server 8123
```

Dann `http://localhost:8123` öffnen. Tests der Outfit-Logik: `npm test` (Node ≥ 14).

## Anpassen & erweitern

| Was | Wo |
|---|---|
| Neue Kleidungsart, Wärme/Formalität ändern | `js/catalog.js` – ein Eintrag pro Art; `prompts` sind englische Beschreibungen für die Bilderkennung |
| Was worüber getragen werden kann | `layer`, `over`, `notOver` in `js/catalog.js` (z. B. Langarm 1 unter T-Shirt 2 unter Hemd 3) |
| Modische Regeln (z. B. „keine Shorts unter 18 °C“) | `RULES` in `js/rules.js` – eine Zeile pro Regel, Plus- oder Minuspunkte |
| Wie warm ein Outfit bei welcher Temperatur sein soll | `WARMTH_CURVE` in `js/rules.js` |
| Farbharmonie (Akzente, Komplementär, Wada-Bonus) | `colorScore` in `js/rules.js`, Farbhilfen in `js/color.js` |
| Welche Farben als „neutral“ gelten | `isNeutral` in `js/color.js` |
| Anzahl Vorschläge, Vielfalt | `generateOutfits` in `js/generator.js` |

## Bekannte Grenzen

- Die Erkennung (CLIP, läuft auf dem Handy) unterscheidet manche ähnliche Teile nicht zuverlässig. Diese sind
  zusammengefasst: Hemd/Polo, Pulli/Sweater/Strickjacke, Chino/Stoffhose. T-Shirt ↔ Langarm und leichte ↔ dicke
  Jacke bleiben bewusst getrennt (wichtig fürs Layering bzw. die Wärme) – hier bitte ggf. im Editor korrigieren.
- Es wird eine Hauptfarbe pro Teil erkannt. Muster (Streifen, Karo) werden noch nicht berücksichtigt.
- Daten liegen nur auf dem Gerät (kein Backup, keine Synchronisation).

Farbdaten: [dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations) (MIT).
