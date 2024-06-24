import { SimpleTranslationEntries } from "#app/interfaces/locales";

/**
 * The menu namespace holds most miscellaneous text that isn't directly part of the game's
 * contents or directly related to Pokemon data. This includes menu navigation, settings,
 * account interactions, descriptive text, etc.
 */
export const menu: SimpleTranslationEntries = {
  "cancel": "Abbrechen",
  "continue": "Fortfahren",
  "dailyRun": "Täglicher Run (Beta)",
  "loadGame": "Spiel laden",
  "newGame": "Neues Spiel",
  "settings": "Einstellungen",
  "selectGameMode": "Wähle einen Spielmodus",
  "logInOrCreateAccount": "Melde dich an oder erstelle einen Account zum starten. Keine Email nötig!",
  "username": "Benutzername",
  "password": "Passwort",
  "login": "Anmelden",
  "register": "Registrieren",
  "emptyUsername": "Benutzername darf nicht leer sein.",
  "invalidLoginUsername": "Der eingegebene Benutzername ist ungültig.",
  "invalidRegisterUsername": "Benutzername darf nur Buchstaben, Zahlen oder Unterstriche enthalten.",
  "invalidLoginPassword": "Das eingegebene Passwort ist ungültig.",
  "invalidRegisterPassword": "Passwort muss 6 Zeichen oder länger sein.",
  "usernameAlreadyUsed": "Der eingegebene Benutzername wird bereits verwendet.",
  "accountNonExistent": "Der eingegebene Benutzer existiert nicht.",
  "unmatchingPassword": "Das eingegebene Passwort stimmt nicht überein.",
  "passwordNotMatchingConfirmPassword": "Passwort muss mit Bestätigungspasswort übereinstimmen.",
  "confirmPassword": "Bestätige Passwort",
  "registrationAgeWarning": "Mit der Registrierung bestätigen Sie, dass Sie 13 Jahre oder älter sind.",
  "backToLogin": "Zurück zur Anmeldung",
  "failedToLoadSaveData": "Speicherdaten konnten nicht geladen werden. Bitte laden Sie die Seite neu.\nÜberprüfe den #announcements-Kanal im Discord bei anhaltenden Problemen.",
  "sessionSuccess": "Sitzung erfolgreich geladen.",
  "failedToLoadSession": "Ihre Sitzungsdaten konnten nicht geladen werden.\nSie könnten beschädigt sein.",
  "boyOrGirl": "Bist du ein Junge oder ein Mädchen?",
  "evolving": "Nanu?\n{{pokemonName}} entwickelt sich!",
  "stoppedEvolving": "Hm? {{pokemonName}} hat die Entwicklung \nabgebrochen.", // "Hm? Entwicklung wurde abgebrochen!" without naming the pokemon seems to be the original.
  "pauseEvolutionsQuestion": "Die Entwicklung von {{pokemonName}} vorübergehend pausieren?\nEntwicklungen können im Gruppenmenü wieder aktiviert werden.",
  "evolutionsPaused": "Entwicklung von {{pokemonName}} pausiert.",
  "evolutionDone": "Glückwunsch!\nDein {{pokemonName}} entwickelte sich zu {{evolvedPokemonName}}!",
  "dailyRankings": "Tägliche Rangliste",
  "weeklyRankings": "Wöchentliche Rangliste",
  "noRankings": "Keine Rangliste",
  "positionIcon": "#",
  "usernameScoreboard": "Benutzername",
  "score": "Punkte",
  "wave": "Welle",
  "loading": "Lade…",
  "loadingAsset": "Lade Asset: {{assetName}}",
  "playersOnline": "{{count}} Spieler Online",
  "yes":"Ja",
  "no":"Nein",
  "disclaimer": "HAFTUNGSAUSSCHLUSS",
  "disclaimerDescription": "Dieses Spiel ist ein unfertiges Produkt. Es kann spielbeinträchtigende Fehler (bis hin zum Verlust des Speicherstandes)\n aufweisen, sich ohne Vorankündigung ändern und es gibt keine Garantie dass es weiterentwickelt oder fertiggestellt wird.",
  "choosePokemon": "Choose a Pokémon.",
  "errorServerDown": "Ups! Es gab einen Fehler beim Versuch\nden Server zu kontaktieren\nLasse dieses Fenster offen\nDu wirst automatisch neu verbunden.",
} as const;
