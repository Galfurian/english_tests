(function () {
    function fail(message) {
        return { valid: false, error: message };
    }

    function isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function validateBaseExercise(exercise, index) {
        if (!exercise || typeof exercise !== 'object') return fail(`Exercise ${index + 1} is invalid.`);
        if (!Number.isInteger(exercise.exerciseId)) return fail(`Exercise ${index + 1} has no valid ID.`);
        if (!isNonEmptyString(exercise.title) || !isNonEmptyString(exercise.text)) return fail(`Exercise ${exercise.exerciseId} is missing a title or text.`);
        return { valid: true };
    }

    function validateGapExerciseCollection(data) {
        if (!Array.isArray(data) || !data.length) return fail('No exercises found.');
        for (let index = 0; index < data.length; index += 1) {
            const base = validateBaseExercise(data[index], index);
            if (!base.valid) return base;
            const { gaps } = data[index];
            if (!Array.isArray(gaps) || !gaps.length) return fail(`Exercise ${data[index].exerciseId} has no gaps.`);
            for (const gap of gaps) {
                if (!Number.isInteger(gap?.id) || !Array.isArray(gap.options) || !gap.options.length || !Number.isInteger(gap.correctIndex) || gap.correctIndex < 0 || gap.correctIndex >= gap.options.length) {
                    return fail(`Exercise ${data[index].exerciseId} contains an invalid gap.`);
                }
            }
        }
        return { valid: true, data };
    }

    function validateTextExerciseCollection(data) {
        if (!Array.isArray(data) || !data.length) return fail('No exercises found.');
        for (let index = 0; index < data.length; index += 1) {
            const result = validateBaseExercise(data[index], index);
            if (!result.valid) return result;
        }
        return { valid: true, data };
    }

    function validateListeningIndex(data) {
        if (!Array.isArray(data) || !data.length) return fail('No listening exercises found.');
        for (const entry of data) {
            if (!isNonEmptyString(entry?.exerciseId) || !isNonEmptyString(entry?.title) || !isNonEmptyString(entry?.data)) return fail('Listening catalogue contains an incomplete entry.');
        }
        return { valid: true, data };
    }

    function validateListeningExercise(data) {
        if (!data || typeof data !== 'object' || !isNonEmptyString(data.exerciseId) || !isNonEmptyString(data.title) || !Array.isArray(data.questions) || !data.questions.length || !data.audio || !isNonEmptyString(data.audio.url)) return fail('Listening exercise is missing required fields.');
        for (const question of data.questions) {
            if (!isNonEmptyString(question?.prompt) || !Array.isArray(question.options) || !question.options.length || !Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.options.length) return fail(`Listening exercise ${data.exerciseId} contains an invalid question.`);
        }
        return { valid: true, data };
    }

    window.EnglishTestsData = { validateGapExerciseCollection, validateTextExerciseCollection, validateListeningIndex, validateListeningExercise };
}());
