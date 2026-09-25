# Spectra RolePlay Verwaltung

Internes Verwaltungsportal für Fahrzeuganträge, Flotten, Bann-Richtlinien, Admin-Jail, Organisationen, Benutzer und Audit-Logs.

## Start lokal

1. Node.js 18+ installieren.
2. `.env.example` nach `.env` kopieren.
3. In `.env` echte Passwörter setzen.
4. `npm install`
5. `npm start`
6. `http://localhost:3000` öffnen.

## Rollen

- **ADMIN**: Anträge prüfen, Fahrzeuge verwalten, Regeln verwalten, Audit einsehen.
- **LEADER**: nur eigene Organisation; Anträge erstellen und eigene Flotte/Status ansehen.
- **PROJEKTLEITUNG**: vollständige Verwaltung inkl. Benutzer/Rollen.

## Sicherheit

- Passwörter werden als Hash gespeichert.
- `.env` darf nicht auf GitHub hochgeladen werden.
- Autorisierung erfolgt serverseitig.
- Session-Tokens sind zeitlich begrenzt.
- Audit-Log protokolliert wichtige Aktionen.

## GitHub

Das Repository kann direkt mit diesen Dateien befüllt werden. Danach kann das Projekt auf einem Node-fähigen Host wie Render, Railway oder einem eigenen Server betrieben werden. Für produktiven Betrieb sollte die JSON-Datei durch PostgreSQL/Supabase ersetzt werden und HTTPS aktiviert sein.
