(function () {
    const MINUTE = 60;

    function createTimer(container, policy = {}) {
        const mode = policy.mode || 'none';
        const enabled = policy.enabled !== false;
        const defaultDuration = Math.max(1, Number(policy.defaultMinutes) || 20) * MINUTE;
        let remaining = defaultDuration;
        let state = 'idle';
        let intervalId = null;

        const wrapper = document.createElement('div');
        wrapper.className = 'timer-widget';
        wrapper.setAttribute('aria-label', 'Practice timer');
        const label = document.createElement('span'); label.className = 'timer-label'; label.textContent = 'Timer';
        const display = document.createElement('strong'); display.className = 'timer-value'; display.setAttribute('aria-live', 'off');
        const status = document.createElement('span'); status.className = 'timer-status visually-hidden'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
        const controls = document.createElement('div'); controls.className = 'timer-controls';
        const buttons = {};
        [['decrease', '−', 'Decrease duration'], ['increase', '+', 'Increase duration'], ['start', '▶', 'Start timer'], ['pause', 'Ⅱ', 'Pause timer'], ['reset', '↺', 'Reset timer']].forEach(([key, symbol, name]) => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'timer-button'; button.innerHTML = `<span aria-hidden="true">${symbol}</span><span class="timer-button-label">${name}</span>`; button.setAttribute('aria-label', name); buttons[key] = button; controls.appendChild(button);
        });
        wrapper.append(label, display, status, controls); container.replaceChildren(wrapper);

        function format(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
        function announce(message) { status.textContent = message; }
        function update() {
            display.textContent = format(remaining);
            const unavailable = !enabled || mode === 'none';
            buttons.decrease.disabled = unavailable || mode === 'fixed' || state === 'running' || remaining <= MINUTE;
            buttons.increase.disabled = unavailable || mode === 'fixed' || state === 'running';
            buttons.start.disabled = unavailable || state === 'running' || state === 'expired' || remaining <= 0;
            buttons.pause.disabled = unavailable || state !== 'running';
            buttons.reset.disabled = unavailable;
            label.textContent = unavailable ? 'Timer not used' : 'Timer';
        }
        function stopInterval() { clearInterval(intervalId); intervalId = null; }
        function setState(nextState, message) { state = nextState; update(); if (message) announce(message); }
        function start() {
            if (buttons.start.disabled) return;
            setState('running', 'Timer started.');
            intervalId = window.setInterval(() => {
                remaining = Math.max(0, remaining - 1); update();
                if (remaining === 0) { stopInterval(); setState('expired', 'Time expired. Your answers have not been submitted.'); }
            }, 1000);
        }
        function pause() { if (buttons.pause.disabled) return; stopInterval(); setState('paused', 'Timer paused.'); }
        function reset() { if (buttons.reset.disabled) return; stopInterval(); remaining = defaultDuration; setState('idle', 'Timer reset.'); }
        buttons.decrease.addEventListener('click', () => { if (buttons.decrease.disabled) return; remaining -= MINUTE; update(); announce(`Timer set to ${format(remaining)}.`); });
        buttons.increase.addEventListener('click', () => { if (buttons.increase.disabled) return; remaining += MINUTE; update(); announce(`Timer set to ${format(remaining)}.`); });
        buttons.start.addEventListener('click', start); buttons.pause.addEventListener('click', pause); buttons.reset.addEventListener('click', reset);
        update(); announce(unavailableMessage());
        function unavailableMessage() { return !enabled || mode === 'none' ? 'Timer is not available for this exercise.' : `Timer ready for ${format(remaining)}.`; }
        return { destroy: () => stopInterval(), reset };
    }

    window.EnglishTestsTimer = { create: createTimer };
}());
