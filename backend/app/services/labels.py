"""Names shown to people next to the original Data KHK values."""

from __future__ import annotations

# Idea 19. The kraj value stays in `stav`. This is only the readable column.
STAV_FOR_PEOPLE = {
    "SUPERhavarijní": "Rozpadlá vozovka",
    "nevyhovující": "Opotřebovaná",
    "havarijní": "Havarijní",
    "vyhovující": "Vyhovující",
}


def stav_for_people(stav: str | None) -> str:
    if not stav:
        return ""
    return STAV_FOR_PEOPLE.get(stav, stav)
