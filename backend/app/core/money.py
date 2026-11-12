def format_paise_to_display(paise: int) -> str:
    """
    Format minor unit (paise) to display unit string (rupees) in ONE place.
    Example: 50000 paise -> '500.00'
    Example: 75 paise -> '0.75'
    Example: 105 paise -> '1.05'
    """
    sign = "-" if paise < 0 else ""
    abs_paise = abs(paise)
    rupees = abs_paise // 100
    remainder = abs_paise % 100
    return f"{sign}{rupees}.{remainder:02d}"


def parse_display_to_paise(display_str: str) -> int:
    """
    Parse display string ('50.25') into integer paise (5025).
    Raises ValueError on invalid formats.
    """
    parts = display_str.strip().split(".")
    if len(parts) == 1:
        return int(parts[0]) * 100
    elif len(parts) == 2:
        rupees = int(parts[0])
        cents = parts[1][:2].ljust(2, "0")
        return (rupees * 100) + int(cents)
    else:
        raise ValueError(f"Invalid monetary string format: {display_str}")
