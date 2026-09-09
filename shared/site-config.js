(function () {
    const defaultConfig = { features: {}, exercises: {} };

    function mergeFeature(globalFeature, localFeature) {
        if (globalFeature === false || localFeature === false) return false;
        if (globalFeature && typeof globalFeature === 'object' || localFeature && typeof localFeature === 'object') {
            return { ...(globalFeature || {}), ...(localFeature || {}) };
        }
        return localFeature ?? globalFeature ?? false;
    }

    function getExercise(config, exerciseId) {
        return config?.exercises?.[exerciseId] || null;
    }

    function resolveFeatures(config, exerciseId) {
        const exercise = getExercise(config, exerciseId) || {};
        const globalFeatures = config?.features || {};
        const localFeatures = exercise.features || {};
        const names = new Set([...Object.keys(globalFeatures), ...Object.keys(localFeatures)]);
        return Object.fromEntries([...names].map((name) => [name, mergeFeature(globalFeatures[name], localFeatures[name])]));
    }

    async function load(url = 'config/site.json') {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const config = await response.json();
            if (!config || typeof config !== 'object' || !config.exercises || typeof config.exercises !== 'object') throw new Error('Invalid site configuration');
            return config;
        } catch (error) {
            console.warn('Site configuration could not be loaded.', error);
            return { ...defaultConfig, loaded: false };
        }
    }

    window.EnglishTestsSiteConfig = { load, getExercise, resolveFeatures };
}());
