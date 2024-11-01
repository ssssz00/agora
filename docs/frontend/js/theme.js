document.addEventListener('DOMContentLoaded', () => {
    const themeOptions = document.querySelectorAll('.radiosetting[data-theme]');
    const themeContainer = document.getElementById('main');

    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        themeContainer.className = savedTheme;
    }

    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const selectedTheme = option.getAttribute('data-theme');
            const themeClass = `theme-${selectedTheme}`;
            themeContainer.className = themeClass;
            localStorage.setItem('theme', themeClass);
        });
    });
});