# Copyright (c) 2026 Vilhelm Hilding. MIT License.
"""Assigns visually distinct colors to equation parts."""

PALETTE = [
    "#E63946", "#1D4ED8", "#06A77D", "#F77F00", "#7209B7",
    "#0EA5E9", "#D62828", "#059669", "#8338EC", "#B45309",
]

HUE_FAMILY = {
    "#E63946": "red",   "#D62828": "red",
    "#1D4ED8": "blue",  "#0EA5E9": "blue",
    "#06A77D": "green", "#059669": "green",
    "#F77F00": "orange","#B45309": "orange",
    "#7209B7": "purple","#8338EC": "purple",
}


def assign_colors(parts: list) -> list:
    assigned: list[str] = []
    for i in range(len(parts)):
        prev_family = HUE_FAMILY.get(assigned[i - 1]) if i > 0 else None
        used = set(assigned)
        for color in PALETTE:
            if color in used:
                continue
            if HUE_FAMILY.get(color) == prev_family:
                continue
            assigned.append(color)
            break
        else:
            for color in PALETTE:
                if color not in used:
                    assigned.append(color)
                    break
            else:
                assigned.append(PALETTE[i % len(PALETTE)])
    for part, color in zip(parts, assigned):
        part["color"] = color
    return parts
