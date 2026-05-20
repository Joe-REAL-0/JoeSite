function setStatus(elementId, message) {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) {
        return;
    }
    statusEl.textContent = message || '';
    if (message) {
        statusEl.classList.add('is-active');
        statusEl.setAttribute('aria-hidden', 'false');
    } else {
        statusEl.classList.remove('is-active');
        statusEl.setAttribute('aria-hidden', 'true');
    }
}

function setAuthMode(mode) {
    const shell = document.querySelector('.auth-shell');
    if (!shell) {
        return;
    }
    shell.dataset.authMode = mode;

    const titleEl = shell.querySelector('.auth-title');
    if (titleEl) {
        const titleMap = {
            login: titleEl.dataset.titleLogin,
            register: titleEl.dataset.titleRegister,
            forgot: titleEl.dataset.titleForgot,
            reset: titleEl.dataset.titleReset,
        };
        titleEl.textContent = titleMap[mode] || titleMap.login || titleEl.textContent;
    }

    const panels = shell.querySelectorAll('[data-auth-panel]');
    panels.forEach((panel) => {
        const isActive = panel.dataset.authPanel === mode;
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const shell = document.querySelector('.auth-shell');
    if (!shell) {
        return;
    }

    setAuthMode(shell.dataset.authMode || 'login');

    document.querySelectorAll('[data-auth-switch]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const target = link.dataset.authSwitch;
            if (!target) {
                return;
            }
            event.preventDefault();
            setAuthMode(target);
        });
    });
});