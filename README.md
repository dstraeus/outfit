# Outfit

Schlichte Web-App (PWA) fürs iPhone: Kleidung fotografieren, die App stellt sie frei, erkennt Art und Farben
(auch Drucke/Streifen) und schlägt passende Outfits vor (Wetter, Layering, Farbharmonie nach Sanzo Wada,
Abwechslung, deine 👍/👎).

Der Startbildschirm zeigt nur das Outfit des Tages als Flat-Lay aus den freigestellten Teilen auf
einheitlichem Hintergrund (👍 / 👎 / Anderes / Anziehen). Kleidung hinzufügen,
Schrank und Temperatur liegen im Menü ☰. Beim ersten Start erklärt die App, welche Teile noch fehlen.
Alles bleibt lokal auf dem Handy, kein Build-Schritt, keine Abhängigkeiten.

## Aufs iPhone bringen

Die App braucht eine HTTPS-Adresse (für Offline-Modus und Standort). Kostenlos über GitHub Pages:

1. Auf github.com ein neues öffentliches Repository anlegen, z. B. `outfit`.
2. Den Inhalt dieses Ordners hochladen („Add file → Upload files“, alle Dateien inkl. `js/`).
3. Repository → Settings → Pages → Branch `main`, Ordner `/ (root)` → Save.
4. Nach ca. 1 Minute auf dem iPhone in **Safari** `https://<dein-name>.github.io/outfit/` öffnen.
5. Teilen-Symbol → **Zum Home-Bildschirm**. Ab jetzt wie eine App starten.

Beim ersten Foto lädt die App einmalig den Freisteller (44–88 MB) und die Bilderkennung (ca. 150 MB) –
am besten im WLAN. Danach funktioniert beides offline. Kleidung am besten **einzeln und hingelegt** fotografieren,
nicht angezogen (sonst bleibt die Person mit im Bild).

## Lokal testen

```bash
python -m http.server 8123
```

Dann `http://localhost:8123` öffnen. Tests der Outfit-Logik: `npm test` (Node ≥ 14).

## Anpassen & erweitern

| Was | Wo |
|---|---|
| Neue Kleidungsart, Wärme/Formalität ändern | `js/catalog.js` – ein Eintrag pro Art; `prompts` sind englische Beschreibungen für die Bilderkennung |
| Anordnung des Flat-Lays | `renderBoard` in `js/app.js` |
| Was worüber getragen werden kann | `layer`, `over`, `notOver` in `js/catalog.js` (z. B. Langarm 1 unter T-Shirt 2 unter Hemd 3) |
| Modische Regeln (z. B. „keine Shorts unter 18 °C“) | `RULES` in `js/rules.js` – eine Zeile pro Regel, Plus- oder Minuspunkte |
| Wie warm ein Outfit bei welcher Temperatur sein soll | `WARMTH_CURVE` in `js/rules.js` |
| Farbharmonie (Akzente, Komplementär, Wada-Bonus) | `colorScore` in `js/rules.js`, Farbhilfen in `js/color.js` |
| Welche Farben als „neutral“ gelten | `isNeutral` in `js/color.js` |
| Anzahl Vorschläge, Vielfalt | `generateOutfits` in `js/generator.js` |

## Bekannte Grenzen

- Kategorien sind bewusst grob: Oberteile (T-Shirt, Longsleeve, Hemd/Polo, Pullover inkl. Hoodie/Strickjacke/Pullunder),
  Jacken (Jacke, Sakko, Weste, Winterjacke inkl. Mantel), Hosen, Schuhe, Accessoires. T-Shirt ↔ Longsleeve und
  Jacke ↔ Winterjacke bleiben getrennt (Layering bzw. Wärme) – hier ggf. im Editor korrigieren.
- Die Erkennung (CLIP, läuft auf dem Handy) ist ein Kompromiss aus Größe und Genauigkeit. Eine bessere Erkennung
  (größeres Modell oder ein Server/KI-Dienst) wäre ein eigener nächster Schritt.
- Freistellen dauert je nach iPhone einige Sekunden pro Teil (mit WebGPU ab iOS 26 schneller).
- Bis zu 3 Farben pro Teil mit Anteil; Drucke ab ca. 10 % Fläche zählen in der Farbbewertung mit,
  ab 2 Farben mit je ≥ 20 % gilt ein Teil als gemustert (zwei gemusterte Teile in einem Outfit kosten Punkte).
- Daten liegen nur auf dem Gerät (kein Backup, keine Synchronisation).

Farbdaten: [dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations) (MIT).
Freisteller: [ISNet](https://huggingface.co/onnx-community/ISNet-ONNX) (AGPL-3.0). Erkennung: CLIP ViT-B/32 (MIT).
