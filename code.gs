/*
* Birthday Calendar for Google Contacts and Calendar using Apps Script
*
* Basierend auf dem Original von th23 (2025)
* Komplett überarbeitet für Sascha (Gemini-Support, Bugfixes, Deutsch)
* VERSION: 1.3.5 (Stable Gemini Edition)
*
* Änderungen gegenüber Original:
* 1. Zielkalender "primary" für Gemini-Sprachsteuerung.
* 2. Advanced API Nutzung um Standard-Benachrichtigungen (23:50 Uhr) zu blockieren.
* 3. Kritischer Bugfix (Null-Check), damit private Termine nicht gelöscht werden.
* 4. Status "Available", damit der Kalender nicht blockiert wird.
*/

// === KONFIGURATION ===

// 1. ZIEL-KALENDER
// Wir nutzen "primary", damit Google Assistant/Gemini die Geburtstage vorlesen kann.
const cal_id = "primary";

// 2. TITEL
// %s wird durch den Namen des Kontakts ersetzt.
const birthday_title = "%s's Geburtstag 🎁";

// 3. DATUMS-FORMAT
// Deutsches Format für die Beschreibung (z.B. * 24.12.1980)
const birthday_description_format = "* dd.MM.yyyy";

// 4. ALTER
// Ab welchem Jahr soll das Alter in Klammern berechnet werden?
const birthday_description_ignore_before = 1901;

// 5. VERFÜGBARKEIT
// "available" = Transparent. Wichtig im Hauptkalender, damit du an Geburtstagen
// trotzdem Termineinladungen erhalten kannst.
const birthday_show_as = "available";

// 6. ERINNERUNGEN (WECKER)
// "false" = Das Skript setzt KEINE Erinnerung.
// WICHTIG: Durch den neuen Code werden auch Googles Zwangs-Benachrichtigungen unterdrückt.
const birthday_reminder_minutes = false;

// 7. UHRZEIT
// "false" = Ganztägiges Ereignis (Empfohlen für Geburtstage)
const birthday_start_time = false;

// 8. DEBUGGING
// "true" = Zeigt dir unten im Fenster genau an, was passiert.
const debug = true;


// === SYSTEM-CODE (Ab hier nichts ändern) ===

const version = "1.3.5-GEMINI-EDITION";

// Dienste laden
const people_service = People.People;
const cal_service = CalendarApp;
const yearly = cal_service.newRecurrence().addYearlyRule();

// Zugriff auf Kalender
const cal_birthday = cal_service.getCalendarById(cal_id);

// Status übersetzen (Text zu Code)
const birthday_status = ("available" == birthday_show_as) ? cal_service.EventTransparency.TRANSPARENT : cal_service.EventTransparency.OPAQUE;

// Startzeit validieren
const birthday_start_hour = (0 <= birthday_start_time && birthday_start_time <= 23) ? birthday_start_time : false;

// Zeitlimit (5,5 Minuten), damit das Skript nicht abstürzt
const exec_limit = 330000;

// HAUPTFUNKTION: UPDATE
function update_birthdays() {

    try {
        if (!cal_birthday) throw new Error("Kalender nicht gefunden! Prüfe 'cal_id'.");

        const start = new Date().getTime();
        if (debug) console.time("Laufzeit");

        const timezone = cal_birthday.getTimeZone();

        // SCHRITT A: Kontakte aus Google Contacts laden
        let contacts_birthdays = {};
        if (debug) console.time("Kontakte laden");

        let page_token = null;
        do {
            // Wir holen Namen und Geburtstage
            const contacts = people_service.Connections.list("people/me", { personFields: 'names,birthdays', pageToken: page_token });
            const connections = contacts.connections || [];

            connections.forEach(connection => {
                const names = connection.names || [];
                const birthdays = connection.birthdays || [];
                // Nur Kontakte speichern, die einen Namen UND ein Geburtsdatum haben
                if (names.length > 0 && birthdays.length > 0 && birthdays[0].date !== undefined) {
                    contacts_birthdays[connection.resourceName] = { name: names[0].displayName, birthday: birthdays[0].date };
                }
            });
            page_token = contacts.nextPageToken;
        } while (page_token);

        if (debug) { console.log(Object.keys(contacts_birthdays).length + " Kontakte mit Geburtstag gefunden."); console.timeEnd("Kontakte laden"); }


        // SCHRITT B: Bestehende Skript-Termine im Kalender finden
        let birthday_events = {};
        if (debug) console.time("Kalender scannen");

        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0);
        const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1); nextYear.setHours(23, 59, 59);

        // BUGFIX: Wir filtern explizit nach Events, die NICHT null sind.
        // Das verhindert, dass deine privaten Termine (Tag = null) erfasst werden.
        const events = cal_birthday.getEvents(tomorrow, nextYear).filter(e => e.getTag("th23_birthday") != null);

        let duplicates = {};

        events.forEach(event => {
            const people_id = event.getTag("th23_birthday");

            // Sicherheits-Check: Falls ein Tag leer ist, überspringen (schützt private Termine)
            if (!people_id) return;

            const event_id = event.getId();

            // Falls wir denselben Geburtstag schonmal gesehen haben -> Es ist ein Duplikat
            if (undefined !== birthday_events[people_id]) {
                duplicates[birthday_events[people_id]["id"]] = { people_id: people_id, title: birthday_events[people_id]["title"] };
                duplicates[event_id] = { people_id: people_id, title: event.getTitle() };
            }

            birthday_events[people_id] = {
                id: event_id,
                title: event.getTitle(),
                date: { day: event.getStartTime().getDate(), month: event.getStartTime().getMonth() + 1, year: event.getStartTime().getFullYear() },
                description: event.getDescription(),
                feb29: event.getTag("th23_birthday_feb29")
            };
        });

        // Duplikate löschen (nur vom Skript erstellte!)
        Object.keys(duplicates).forEach(function (event_id) {
            if (debug) console.log("Lösche Duplikat: " + duplicates[event_id].title);
            cal_birthday.getEventSeriesById(event_id).deleteEventSeries();
            delete birthday_events[duplicates[event_id]["people_id"]];
        });

        if (debug) { console.log(Object.keys(birthday_events).length + " Skript-Termine im Kalender gefunden."); console.timeEnd("Kalender scannen"); }


        // SCHRITT C: Abgleich (Löschen & Updates)
        Object.keys(birthday_events).forEach(function (people_id) {
            const birthday = birthday_events[people_id];

            // 1. Fall: Kontakt wurde im Telefonbuch gelöscht -> Termin auch löschen
            if (undefined === contacts_birthdays[people_id]) {
                cal_birthday.getEventSeriesById(birthday.id).deleteEventSeries();
                delete birthday_events[people_id];
                if (debug) console.log("Gelöscht (Kontakt existiert nicht mehr): " + birthday.title);
                return;
            }

            const contact = contacts_birthdays[people_id];
            const contact_birthday = contact.birthday["month"] + "-" + contact.birthday["day"];
            const birthday_date = birthday.date["month"] + "-" + birthday.date["day"];
            let birthday_series = cal_birthday.getEventSeriesById(birthday.id);

            // 2. Fall: Datum geändert oder Schaltjahr-Wechsel -> Neu anlegen (einfacher als Update)
            if ((("2-29" == contact_birthday || "2-29" == birthday_date) && !birthday.feb29) || ("2-29" != contact_birthday && (birthday.feb29 || "2-29" == birthday_date))) {
                birthday_series.deleteEventSeries();
                delete birthday_events[people_id];
                if (debug) console.log("Datum geändert (Schaltjahr Logik): " + contact.name);
                return;
            }
            else if (birthday_date != contact_birthday && !birthday.feb29) {
                // Normales Datum-Update
                if (false === birthday_start_hour) {
                    birthday_series.setRecurrence(yearly, get_birthday_date(contact.birthday));
                } else {
                    const hours = get_birthday_hours(contact.birthday);
                    birthday_series.setRecurrence(yearly, hours.start, hours.end);
                }
                if (debug) console.log("Datum korrigiert für: " + contact.name);
            }

            // 3. Fall: Name oder Alter hat sich geändert -> Titel aktualisieren
            const b_title = get_birthday_title(contact.name);
            const b_title_age = get_birthday_title_age(b_title, birthday.date["year"], contact.birthday["year"]);
            if (birthday.title !== b_title && birthday.title !== b_title_age) {
                birthday_series.setTitle(b_title);
            }

            // 4. Fall: Beschreibung aktualisieren
            const b_desc = get_birthday_description(contact.birthday, timezone);
            if (birthday.description !== b_desc) {
                birthday_series.setDescription(b_desc);
            }

            // Timeout-Schutz
            if (new Date().getTime() - start > exec_limit) throw new Error("Zeitlimit erreicht - Fortsetzung beim nächsten Mal.");
        });


        // SCHRITT D: Neue Termine erstellen
        Object.keys(contacts_birthdays).forEach(function (people_id) {

            // Wenn der Kontakt noch keinen Termin im Kalender hat...
            if (undefined === birthday_events[people_id]) {
                if (debug) console.time("Erstelle");
                const contact = contacts_birthdays[people_id];
                let new_series = undefined;
                let isFeb29 = (2 == contact.birthday["month"] && 29 == contact.birthday["day"]);

                // VARIANTE 1: Ganztägig (mit Advanced API für Benachrichtigungs-Blockade)
                if (false === birthday_start_hour) {
                    const bdate = get_birthday_date(contact.birthday);

                    // Formatierung für API (YYYY-MM-DD)
                    const start_str = Utilities.formatDate(bdate, timezone, "yyyy-MM-dd");
                    const edate = new Date(bdate); edate.setDate(edate.getDate() + 1);
                    const end_str = Utilities.formatDate(edate, timezone, "yyyy-MM-dd");

                    let rrule = "RRULE:FREQ=YEARLY";
                    if (isFeb29) { rrule = "RRULE:FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=-1"; }

                    // Das Event-Objekt
                    const event_resource = {
                        summary: get_birthday_title(contact.name),
                        description: get_birthday_description(contact.birthday, timezone),
                        start: { date: start_str },
                        end: { date: end_str },
                        recurrence: [rrule],
                        // HIER IST DER FIX: Wir verbieten Standard-Benachrichtigungen!
                        reminders: { useDefault: false },
                        transparency: (birthday_status == cal_service.EventTransparency.TRANSPARENT) ? "transparent" : "opaque"
                    };

                    // Falls manuelle Erinnerungen gewünscht sind (oben konfiguriert)
                    if (birthday_reminder_minutes !== false) {
                        event_resource.reminders.overrides = [{ method: 'popup', minutes: Number(birthday_reminder_minutes) }];
                        event_resource.reminders.useDefault = false;
                    }

                    try {
                        // Erstellung via Advanced API
                        const inserted_event = Calendar.Events.insert(event_resource, cal_id);
                        new_series = cal_birthday.getEventSeriesById(inserted_event.iCalUID);
                        if (isFeb29) { new_series.setTag("th23_birthday_feb29", "feb29"); }
                    } catch (e) {
                        console.error("Fehler beim Erstellen von " + contact.name + ": " + e.message);
                    }

                }
                // VARIANTE 2: Uhrzeit-Event (Nutzung der Standard-API)
                else {
                    const birthday_hours = get_birthday_hours(contact.birthday);
                    new_series = cal_birthday.createEventSeries(get_birthday_title(contact.name), birthday_hours.start, birthday_hours.end, yearly, { description: get_birthday_description(contact.birthday, timezone) });
                    if (false !== birthday_reminder_minutes) {
                        new_series.addPopupReminder(Number(birthday_reminder_minutes));
                    }
                    new_series.setTransparency(birthday_status);
                }

                // Tagging (Der unsichtbare Stempel für die Wiedererkennung)
                if (new_series) {
                    new_series.setTag("th23_birthday", people_id);
                    if (debug) { console.log("Neu angelegt: " + contact.name); console.timeEnd("Erstelle"); }
                }

            }

            if (new Date().getTime() - start > exec_limit) throw new Error("Zeitlimit erreicht - Fortsetzung beim nächsten Mal.");
        });


        // SCHRITT E: Titel von zukünftigen Events anpassen (wegen Alter)
        // Auch hier: BUGFIX Filter (nur getaggte Events)
        const next_birthdays = cal_birthday.getEvents(tomorrow, nextYear).filter(e => e.getTag("th23_birthday") != null);
        next_birthdays.forEach(event => {
            const people_id = event.getTag("th23_birthday");
            if (contacts_birthdays[people_id]) {
                const contact = contacts_birthdays[people_id];
                const b_title = get_birthday_title(contact.name);
                const b_title_age = get_birthday_title_age(b_title, event.getStartTime().getFullYear(), contact.birthday["year"]);

                if (b_title_age !== event.getTitle()) { event.setTitle(b_title_age); }
            }
        });

        if (debug) { console.timeEnd("Laufzeit"); }

        // Monatliche "Ich lebe noch" E-Mail
        const now = new Date();
        const last_day = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        if (last_day.getDate() == now.getDate()) {
            GmailApp.sendEmail(Session.getActiveUser().getEmail(), "Status: Geburtstagskalender", "Alles läuft rund.");
        }

    } catch (error) {
        if (debug) console.error(error.message);
        else GmailApp.sendEmail(Session.getActiveUser().getEmail(), "Fehler: Geburtstagskalender", error.message);
    }
}

// === HILFSFUNKTIONEN ===
function get_birthday_title(name) { return (birthday_title.includes("%s")) ? birthday_title.replace("%s", name) : name; }
function get_birthday_title_age(title, evt_year, birth_year) { return (undefined !== birth_year && birth_year > Number(birthday_description_ignore_before)) ? title + " (" + (evt_year - birth_year) + ")" : title; }
function get_birthday_date(c_birthday) { const today = new Date(); return new Date((today.getFullYear() - 1), (c_birthday["month"] - 1), c_birthday["day"]); }
function get_birthday_hours(c_birthday) {
    let s = get_birthday_date(c_birthday); s.setHours(birthday_start_hour, 0, 0);
    let e = get_birthday_date(c_birthday); e.setHours(birthday_start_hour + 1, 0, 0);
    return { start: s, end: e };
}
function get_birthday_description(c_birthday, tz) { return (undefined !== c_birthday["year"] && c_birthday["year"] > Number(birthday_description_ignore_before)) ? Utilities.formatDate(new Date(c_birthday["year"], (c_birthday["month"] - 1), c_birthday["day"]), tz, birthday_description_format) : ""; }

// FUNKTION ZUM LÖSCHEN (Nur Skript-Events!)
function delete_birthdays() {
    try {
        if (!cal_birthday) throw new Error("Kalender nicht gefunden");
        const start = new Date().getTime();
        if (debug) console.time("Löschen");

        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0);
        const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1); nextYear.setHours(23, 59, 59);

        // CRITICAL BUGFIX: != null (schützt private Termine)
        const events = cal_birthday.getEvents(tomorrow, nextYear).filter(e => e.getTag("th23_birthday") != null);

        events.forEach(event => {
            cal_birthday.getEventSeriesById(event.getId()).deleteEventSeries();
            if (new Date().getTime() - start > exec_limit) throw new Error("Zeitlimit beim Löschen. Bitte nochmal starten.");
        });
        if (debug) { console.log(events.length + " Serien gelöscht."); console.timeEnd("Löschen"); }
    } catch (e) { console.error(e.message); }
}