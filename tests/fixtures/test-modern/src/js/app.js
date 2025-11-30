"use strict";
function createGreeting(message) {
    return {
        message,
        timestamp: new Date()
    };
}
document.addEventListener('DOMContentLoaded', () => {
    const greeting = createGreeting('Hello from TypeScript!');
    const element = document.getElementById('greeting');
    if (element) {
        element.textContent = greeting.message;
    }
});
