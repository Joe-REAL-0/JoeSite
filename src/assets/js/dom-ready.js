// Astro may inline a bundled entry, or execute it after DOMContentLoaded.
export function onDomReady(initialize) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
}
