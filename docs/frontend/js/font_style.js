document.addEventListener('DOMContentLoaded', () => {
    const fontOptions = document.querySelectorAll('.radiosetting[data-typeset]');
    const chatContainer = document.querySelector('.chat');

    // Load saved font from localStorage and set it on .chat
    const savedFont = localStorage.getItem('fontFamily') || 'mono';
    chatContainer.style.setProperty('--font-family', savedFont === 'serif' 
        ? '"Avenir", "Helvetica", "Arial", sans-serif' 
        : '"Fira Code", "Consolas", monospace');

    // Set up event listeners for font options
    fontOptions.forEach(option => {
        option.addEventListener('click', () => {
            const selectedFont = option.getAttribute('data-typeset');
            const fontFamily = selectedFont === 'serif' 
                ? '"Avenir", "Helvetica", "Arial", sans-serif' 
                : '"Fira Code", "Consolas", monospace';
            
            // Update CSS variable for --font-family
            chatContainer.style.setProperty('--font-family', fontFamily);

            // Save the selected font type to localStorage
            localStorage.setItem('fontFamily', selectedFont);
        });
    });
});
