<script module lang="ts">
  export const themeStorageKey = 'joe-site-theme';
  type Theme = 'dark' | 'light';

  function apply(theme: Theme | null) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.dataset.theme = theme;
      document.body.dataset.bodyTheme = theme;
    } else {
      delete document.documentElement.dataset.theme;
      delete document.body.dataset.bodyTheme;
    }
  }

  function getEffective(): Theme {
    const override = document.documentElement.dataset.theme;
    if (override === 'light' || override === 'dark') return override;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function toggle() {
    const next = getEffective() === 'dark' ? 'light' : 'dark';
    apply(next);
    try {
      localStorage.setItem(themeStorageKey, next);
    } catch {
      // 本地存储不可用时，本页的按钮仍然可以切换主题。
    }
  }

  // Both islands share the document's theme and a single cross-tab listener.
  if (typeof window !== 'undefined') {
    Object.assign(window, { JoeTheme: { apply, getEffective, toggle } });
    window.addEventListener('storage', (event) => {
      if (event.key !== themeStorageKey && event.key !== null) return;
      if (event.storageArea !== localStorage) return;
      const value = event.newValue;
      apply(value === 'dark' || value === 'light' ? value : null);
    });
  }
</script>

<script lang="ts">
  let { id }: { id: string } = $props();
</script>

<button {id} type="button" class="top-btn cyber-control" title="切换浅色/深色主题" aria-label="切换主题" onclick={toggle}>
  <span class="theme-icon-sun" aria-hidden="true"></span>
  <span class="theme-icon-moon" aria-hidden="true"></span>
</button>
