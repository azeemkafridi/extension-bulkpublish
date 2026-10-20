// `enabled` is true, false, or null when Safari could not report the state.
function show(enabled) {
    document.body.classList.toggle('state-on', enabled === true);
    document.body.classList.toggle('state-off', enabled === false);
}

// Called when Settings could not be opened directly and Safari was opened instead.
function showFallback() {
    document.querySelector('.fallback').hidden = false;
    document.querySelector('.after').hidden = true;
    const button = document.querySelector('button.open-preferences');
    button.disabled = false;
    button.innerText = 'Open Safari Again';
}

function openPreferences() {
    const button = document.querySelector('button.open-preferences');
    button.disabled = true;
    webkit.messageHandlers.controller.postMessage('open-preferences');
}

document.querySelector('button.open-preferences').addEventListener('click', openPreferences);
