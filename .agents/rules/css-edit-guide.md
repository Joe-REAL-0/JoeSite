---
trigger: always_on
---

When writing or modifying CSS for this project, you must strictly adhere to the following styling rules:

    Color & Material Variables (theme.css): All color-related and material-related CSS properties must exclusively use CSS variables defined in theme.css. Hardcoded color values are strictly prohibited.

    Size Variables (global.css): All dimension and size-related CSS properties must exclusively use CSS variables defined in global.css. Hardcoded size values are strictly prohibited.

    Adding New Variables: If you discover that a new styling variable is needed during development, you must first define it in the appropriate global file (theme.css for colors, or global.css for sizes) before referencing it in the CSS file you are currently editing.

    Local Variable Mapping via body:

    For all visible elements in the CSS script, properties including padding, border-radius, gap, and height MUST be defined as local CSS variables (unless their value is auto).

    These local variables must be declared inside the body selector.

    The values of these local variables must be derived from (or calculated using) the global variables provided in theme.css and global.css.

    The target elements must then reference these locally mapped variables for their actual styling.

    Important: Do NOT add any extra, unrelated structural or visual styling rules to the body selector. It should only be used as a scope container for these variable definitions.