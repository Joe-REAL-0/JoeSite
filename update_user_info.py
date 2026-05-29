import re

html_path = '/Users/joe/Desktop/python_projects/JoeSite/templates/user_info.html'
css_path = '/Users/joe/Desktop/python_projects/JoeSite/static/css/html-style/user_info.css'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Add glass-effect to section-surfaces
html = html.replace('class="section-surface menu-surface"', 'class="section-surface menu-surface glass-effect"')
html = html.replace('class="section-surface content-surface"', 'class="section-surface content-surface glass-effect"')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)


with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# Replace body completely
new_body = """body {
    --menu-item-height: var(--pill-height-sm);
    --menu-item-padding: var(--space-sm);
    --menu-item-radius: var(--pill-radius-sm);

    --surface-padding: var(--space-md);
    --surface-gap: var(--space-md);
    --surface-radius: calc(var(--surface-padding) + var(--menu-item-radius));

    --inner-item-padding: var(--space-sm) var(--space-md);
    --inner-item-radius: var(--pill-radius-sm);

    --content-container-padding: var(--space-md);
    --content-container-radius: calc(var(--content-container-padding) + var(--inner-item-radius));

    --avatar-size: 160px;
    --avatar-big-size: 200px;
    --avatar-padding: var(--space-xs);

    --back-btn-size: var(--pill-height-sm);
    --back-btn-radius: 50%;
}"""
css = re.sub(r'body\s*\{[^}]*\}', new_body, css, count=1)

# Remove .glassmorphism
css = re.sub(r'\.glassmorphism\s*\{[^}]*\}\n*', '', css)

# Fix .section-surface
css = re.sub(r'padding:\s*var\(--section-pad\);', 'padding: var(--surface-padding);', css)
css = re.sub(r'border-radius:\s*var\(--section-outer-radius\);', 'border-radius: var(--surface-radius);', css)
css = re.sub(r'gap:\s*var\(--space-md\);', 'gap: var(--surface-gap);', css)
css = re.sub(r'\s*backdrop-filter:[^;]+;', '', css)
css = re.sub(r'\s*-webkit-backdrop-filter:[^;]+;', '', css)

# Fix .menu-item
css = re.sub(r'border-radius:\s*calc\(var\(--space-sm\) \+ 25px\);', 'border-radius: var(--menu-item-radius);', css)
css = re.sub(r'min-height:\s*var\(--pill-height\);', 'min-height: var(--menu-item-height);', css)

# Fix .pill-btn, .submit-btn, .file-upload-btn, .code-btn
css = re.sub(r'height:\s*var\(--pill-height\);', 'height: var(--menu-item-height);', css)
css = re.sub(r'border-radius:\s*var\(--pill-radius\);', 'border-radius: var(--inner-item-radius);', css)

# Fix .back-to-menu
css = re.sub(r'width:\s*var\(--pill-height\);', 'width: var(--back-btn-size);', css)
css = re.sub(r'height:\s*var\(--pill-height\);', 'height: var(--back-btn-size);', css)
css = css.replace('border-radius: 50%;', 'border-radius: var(--back-btn-radius);', 1)

# Fix #content-container
css = re.sub(r'padding:\s*var\(--space-md\);', 'padding: var(--content-container-padding);', css)
css = re.sub(r'border-radius:\s*var\(--section-inner-radius\);', 'border-radius: var(--content-container-radius);', css)

# Fix form inputs and items
css = re.sub(r'padding:\s*12px 16px;', 'padding: var(--inner-item-padding);', css)
css = re.sub(r'padding:\s*10px 14px;', 'padding: var(--inner-item-padding);', css)

# Fix .profile-avatar
css = re.sub(r'width:\s*160px;', 'width: var(--avatar-size);', css)
css = re.sub(r'height:\s*160px;', 'height: var(--avatar-size);', css)
css = re.sub(r'padding:\s*var\(--space-xs\);', 'padding: var(--avatar-padding);', css)

# Fix .current-avatar
css = re.sub(r'width:\s*200px;', 'width: var(--avatar-big-size);', css)
css = re.sub(r'height:\s*200px;', 'height: var(--avatar-big-size);', css)

# In @media (max-width: 768px)
css = re.sub(r'--pill-height:\s*44px;', '--menu-item-height: 44px;\n        --menu-item-radius: calc(var(--menu-item-height) / 2);\n        --inner-item-radius: calc(var(--menu-item-height) / 2);\n        --back-btn-size: 44px;', css)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

print("Update complete.")
