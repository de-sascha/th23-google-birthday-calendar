# Generating the markdown file
file_content = """# th23 Birthday Calendar (Gemini Edition)

## Introduction

This is a customized and modernized fork of the original **th23 Birthday Calendar** script. It automates the synchronization of birthdays from **Google Contacts** into a designated **Google Calendar**.

**Version:** 1.3.5 (Stable Gemini Edition)  
**Based on:** [th23-google-birthday-calendar](https://github.com/th23x/th23-google-birthday-calendar)

### Why this Edition?
This version has been completely overhauled ("Gemini Edition") to support modern Google ecosystems better:
1.  **Voice Assistant Ready:** Syncs to the `primary` calendar so Google Assistant/Gemini can announce birthdays.
2.  **Notification Fix:** Uses the Advanced Calendar API to block Google's default "10 minutes before midnight" notifications.
3.  **Safety First:** Includes a critical null-check bugfix to ensure your private/manual appointments are never deleted.
4.  **Availability:** Sets events to "Available" (Transparent) so birthdays don't block your schedule for meetings.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [How it Works](#how-it-works)
5. [Automation (Triggers)](#automation-triggers)
6. [Troubleshooting](#troubleshooting)
7. [License & Credits](#license--credits)

---

## Prerequisites

Before installing, ensure you have:
- A **Google Account**.
- Contacts with **Birthdays** entered in [Google Contacts](https://contacts.google.com).
- Access to [Google Apps Script](https://script.google.com).

---

## Installation

### 1. Create the Script
1. Open [Google Apps Script](https://script.google.com).
2. Click **New Project**.
3. Name the project `Birthday Calendar Sync`.
4. Delete any existing code in the editor (`myFunction`...) and paste the full code provided in the `Code.gs` file.

### 2. Add Advanced Services (Critical)
This script uses advanced APIs that must be enabled manually in the editor.

1. On the left sidebar, click the **+ (plus)** icon next to **Services**.
2. Find and select **Google People API**.
   - Identifier: `People`
   - Click **Add**.
3. Click **+** again.
4. Find and select **Google Calendar API**.
   - Identifier: `Calendar`
   - Click **Add**.

> ⚠️ **Note:** If you do not add these services, the script will fail with `ReferenceError: People is not defined`.

---

## Configuration

The script contains a configuration block at the top. You can adjust these values to suit your needs:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `cal_id` | `"primary"` | The ID of the calendar. Use `"primary"` to sync to your main calendar (required for Assistant voice announcements). |
| `birthday_title` | `"%s's Geburtstag 🎁"` | The title of the event. `%s` is the placeholder for the contact's name. |
| `birthday_description_format` | `"* dd.MM.yyyy"` | Date format used in the event description to show the original birth year. |
| `birthday_show_as` | `"available"` | Sets the event status. `"available"` prevents the birthday from blocking your calendar as "Busy". |
| `birthday_reminder_minutes` | `false` | Set to `false` to disable reminders completely, or an integer (e.g., `60`) for a pop-up 1 hour before. |
| `birthday_start_time` | `false` | Set to `false` for All-Day events (recommended). Set to an hour (0-23) for a specific start time. |

---

## How it Works

To run the script manually:
1. Select `update_birthdays` from the function dropdown menu in the toolbar.
2. Click **Run**.
3. Grant the necessary permissions when prompted.

### The Sync Process
1.  **Fetch:** Downloads all contacts with names and birthdays from Google Contacts.
2.  **Scan:** Checks the calendar for existing events tagged with `th23_birthday`.
    * *Safety Feature:* Ignores any event that does not have this specific tag (your manual appointments are safe).
3.  **Clean:** Removes duplicates or events for contacts that were deleted.
4.  **Update:** Updates titles (for age calculation) or dates (if corrected in Contacts).
5.  **Create:** Creates new events for new contacts using the **Advanced API** to prevent default notifications.

---

## Automation (Triggers)

To keep your calendar up to date automatically:

1. In the Apps Script editor, click the **Alarm Clock icon (Triggers)** on the left sidebar.
2. Click **+ Add Trigger** (bottom right).
3. Configure the trigger:
   - **Choose which function to run:** `update_birthdays`
   - **Select event source:** `Time-driven`
   - **Select type of time based trigger:** `Day timer` (or `Week timer`)
   - **Select time of day:** `Midnight to 1am` (or any preferred time)
4. Click **Save**.

The script will now run automatically and sync any changes made in your contacts.

---

## Troubleshooting

### Script Timeout (`Exceeded maximum execution time`)
Google Apps Script has a runtime limit (usually 6 minutes).
- **Solution:** The script is built with a failsafe (`exec_limit`). If it times out, simply run it again. It will pick up where it left off.

### "ReferenceError: People is not defined"
- **Solution:** You forgot to add the "People API" service. See the [Installation](#installation) section.

### Deleting All Script Events
If you want to remove all birthdays created by this script:
1. Select the function `delete_birthdays`.
2. Click **Run**.
3. This will **only** delete events created by this script (checking for the internal tag).

---

## License & Credits

**Original Author:** [th23](https://github.com/th23x)  
**Gemini Edition Modifications:** Sascha & Gemini AI

This project is licensed under the MIT License - see the [original repository](https://github.com/th23x/th23-google-birthday-calendar) for full details.

### Changelog (Gemini Edition 1.3.5)
- **Primary Calendar:** Defaulted to `primary` for voice integration.
- **Notification Block:** Implemented `Calendar.Events.insert` with `reminders: { useDefault: false }`.
- **Bugfix:** Added null-check for `getTag()` to prevent crashing on private events.
- **German Localization:** Defaulted date formats and titles to German standards.

---
*Documentation generated automatically.*
"""

with open('README_Gemini_Edition.md', 'w') as f:
    f.write(file_content)