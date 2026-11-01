(function () {
    function read(key, fallback = {}) {
        try {
            const value = JSON.parse(window.localStorage.getItem(key) || 'null');
            return value && typeof value === 'object' ? value : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function write(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            return false;
        }
    }

    window.EnglishTestsStorage = { read, write };
}());
