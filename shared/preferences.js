(function () {
    const STORAGE_KEY = 'englishTests.preferences.v1';
    const root = document.documentElement;
    const read = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (error) { return {}; } };
    const save = (value) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (error) { /* optional */ } };
    function apply(preferences) {
        const theme = preferences.theme || 'system';
        root.dataset.theme = theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : (theme === 'system' ? 'dark' : theme);
        root.dataset.textSize = preferences.textSize || 'normal';
        root.dataset.density = preferences.density || 'standard';
    }

    // Apply visual preferences before stylesheets finish rendering to avoid a flash.
    apply(read());

    function init() {
        let preferences = read();
        document.querySelectorAll('[data-preference]').forEach((control) => {
            control.value = preferences[control.dataset.preference] || control.options[0].value;
        });
        document.querySelectorAll('[data-preference]').forEach((control) => control.addEventListener('change', () => { preferences = { ...preferences, [control.dataset.preference]: control.value }; save(preferences); apply(preferences); }));
        window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if ((read().theme || 'system') === 'system') apply(read()); });
    }
    window.addEventListener('DOMContentLoaded', init);
}());
