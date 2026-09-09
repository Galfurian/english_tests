(function () {
    function mount(container, options) {
        const { exercises, currentIndex, features, onExerciseChange } = options;
        let selectedIndex = currentIndex;
        container.replaceChildren(); container.hidden = false; container.className = 'exercise-toolbar'; container.setAttribute('role', 'toolbar'); container.setAttribute('aria-label', 'Exercise controls');
        const progress = document.createElement('span'); progress.className = 'toolbar-progress';
        const selectorGroup = document.createElement('div'); selectorGroup.className = 'toolbar-selector';
        const selectorLabel = document.createElement('label'); selectorLabel.textContent = 'Change exercise'; selectorLabel.htmlFor = 'exerciseSelector';
        const selector = document.createElement('select'); selector.id = 'exerciseSelector'; selector.className = 'toolbar-select';
        exercises.forEach((exercise, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = `Exercise ${index + 1}: ${exercise.title}`; selector.appendChild(option); });
        selectorGroup.append(selectorLabel, selector);
        const timerContainer = document.createElement('div'); timerContainer.className = 'toolbar-timer';
        let timer = null;
        if (features.progress !== false) container.appendChild(progress);
        if (features.exerciseSelector !== false) container.appendChild(selectorGroup);
        const timerFeature = features.timer === true ? { enabled: true, mode: 'optional', defaultMinutes: 20 } : features.timer;
        if (timerFeature && typeof timerFeature === 'object' && timerFeature.enabled !== false) { timer = window.EnglishTestsTimer.create(timerContainer, timerFeature); container.appendChild(timerContainer); }

        function update(index) {
            if (selectedIndex !== index) timer?.reset();
            selectedIndex = index;
            progress.textContent = `Exercise ${index + 1} of ${exercises.length}`;
            selector.value = String(index);
        }
        selector.addEventListener('change', () => { const accepted = onExerciseChange(Number(selector.value)); if (accepted === false) selector.value = String(selectedIndex); });
        update(currentIndex);
        return { update, destroy: () => timer?.destroy() };
    }
    window.EnglishTestsToolbar = { mount };
}());
