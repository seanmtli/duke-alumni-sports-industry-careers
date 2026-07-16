#!/usr/bin/env python3
"""
Canonical Duke sports-club catalog (mirrors supabase migration seed + src/lib/clubs.ts).
Shared by discover_clubs.py, apply_club_schema.py, and export scripts.
"""

CLUBS = [
    {
        "slug": "dsbc",
        "name": "Duke Sports Business Conference",
        "short_name": "DSBC",
        "school_scope": "undergraduate",
        "description": (
            "Alumni who organized or participated in the Duke Sports Business Conference."
        ),
        "sort_order": 1,
        "match_patterns": {
            "activities": [
                "Duke Sports Business Conference",
                "DSBC",
            ],
            "employers": [
                "Duke Sports Business Conference",
            ],
            "require_fuqua": False,
        },
    },
    {
        "slug": "dsac",
        "name": "Duke Sports Analytics Club",
        "short_name": "DSAC",
        "school_scope": "undergraduate",
        "description": "Alumni of the Duke Sports Analytics Club.",
        "sort_order": 2,
        "match_patterns": {
            "activities": [
                "Duke Sports Analytics",
                "Sports Analytics Club",
                "DSAC",
            ],
            "employers": [
                "Duke Sports Analytics Club",
                "Duke Sports Analytics",
            ],
            "require_fuqua": False,
        },
    },
    {
        "slug": "fuqua-mes",
        "name": "Fuqua Media, Entertainment, and Sports Club",
        "short_name": "MES",
        "school_scope": "fuqua",
        "description": "Alumni of Fuqua's Media, Entertainment, and Sports (MES) Club.",
        "sort_order": 3,
        "match_patterns": {
            "activities": [
                "Media, Entertainment, and Sports",
                "Media Entertainment & Sports",
                "Media, Entertainment & Sports",
                "MES Club",
            ],
            "employers": [
                "Fuqua Media, Entertainment, and Sports",
                "Media, Entertainment, and Sports Club",
            ],
            "require_fuqua": True,
        },
    },
]

CLUBS_BY_SLUG = {c["slug"]: c for c in CLUBS}
