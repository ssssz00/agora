document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const chat = document.querySelector('.chat');
    const messagesContainer = document.querySelector('.__w_messages');
    const messageInput = document.querySelector('textarea.__w_messageInput');
    const userListContainer = document.querySelector('.sidebar-user-list'); // Added for active users

    // Set the character limit
    const CHARACTER_LIMIT = 256;

    // Display remaining characters below the input area
    const characterCount = document.createElement('div');
    characterCount.classList.add('character-count');
    characterCount.textContent = `0/${CHARACTER_LIMIT}`;
    messageInput.parentNode.insertBefore(characterCount, messageInput.nextSibling);

    const password = prompt("Enter a password to generate your tripcode:");
    const tripcode = generateTripcode(password);
    let username = `nemnem#${tripcode}`;

    // Register the initial user
    socket.emit('register user', username); // Emit 'register user' after setting username

    let currentMessageId = null;
    let isTyping = false;
    let typingInterval; // Interval to repeatedly send typing updates

    // Define emojis and their image paths
    const emojis = {
        'sob': '_emojis/sob.png',
        'smile': '_emojis/smile.png',
        'heart': '_emojis/heart.png',
        'laugh': '_emojis/laugh.png'
    };

    // Function to replace emoji syntax with emoji images
    function replaceEmojiSyntax(text) {
        return text.replace(/\((\w+)\)/g, (match, emojiName) => {
            if (emojis[emojiName]) {
                return `<img src="${emojis[emojiName]}" alt="${emojiName}" class="emoji-img" />`;
            }
            return match; // If no matching emoji, keep original text
        });
    }

    socket.on('connect', () => {
        messageInput.disabled = false;
        messageInput.placeholder = 'Escreva sua mensagem';
    });

    socket.on('connect_error', (err) => {
        console.error('Connection error:', err);
        messageInput.placeholder = 'Connection Error';
    });

    socket.on('previous messages', (messages) => {
        messages.forEach((message) => {
            const msg = JSON.parse(message);
            displayMessage(msg);
        });
    });

    socket.on('chat message', (msg) => {
        displayMessage(msg);
    });

    socket.on('user typing', (data) => {
        let messageElement = document.getElementById(`msg-${data.id}`);
        if (!messageElement) {
            messageElement = createMessageElement(data.id, data.username, '', 'in-progress');
            messagesContainer.appendChild(messageElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });

    socket.on('update typing', (data) => {
        const messageElement = document.getElementById(`msg-${data.id}`);
        if (messageElement) {
            const textSpan = messageElement.querySelector('.text');
            textSpan.innerHTML = replaceEmojiSyntax(data.text); // Replace emojis in typing preview
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });

    socket.on('stop typing', (data) => {
        const messageElement = document.getElementById(`msg-${data.id}`);
        if (messageElement) {
            messageElement.remove();
        }
    });

    // Listen for 'user list' event to update active users list
    socket.on('user list', (userList) => {
        userListContainer.innerHTML = ''; // Clear the current list

        userList.forEach((username) => {
            const userItem = document.createElement('div');
            userItem.classList.add('user-item');
            userItem.textContent = username;
            userListContainer.appendChild(userItem);
        });
    });

    // Prevent Enter during Control + V for pasting
    messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            return;
        }

        // Finalize the message with Enter key on keydown
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const text = messageInput.value.trim();
            if (text) {
                // Handle /nick command
                if (text.startsWith('/nick ')) {
                    const newNick = text.slice(6).trim();
                    if (newNick.length > 0) {
                        username = `${newNick}#${tripcode}`;
                        alert(`Nickname updated to ${newNick}`);
                        socket.emit('register user', username); // Emit 'register user' after nickname change
                    }
                    messageInput.value = '';
                    updateCharacterCount();
                    return;
                }

                if (currentMessageId) {
                    const message = {
                        id: currentMessageId,
                        username: username,
                        text: text, // Send text without replacing emojis
                        timestamp: new Date().toISOString()
                    };
                    socket.emit('chat message', message);
                    socket.emit('stop typing', { id: currentMessageId });
                    currentMessageId = null;
                }
                messageInput.value = '';
                isTyping = false;
                clearInterval(typingInterval);
                updateCharacterCount();
            } else if (currentMessageId) {
                socket.emit('stop typing', { id: currentMessageId });
                currentMessageId = null;
                isTyping = false;
                clearInterval(typingInterval);
            }
        }
    });

    // Handle keydown for continuous typing updates
    messageInput.addEventListener('keydown', () => {
        if (isTyping) return;
        isTyping = true;

        if (!currentMessageId) {
            currentMessageId = generateUniqueId();
            socket.emit('start typing', { id: currentMessageId, username: username });
        }

        typingInterval = setInterval(() => {
            const text = messageInput.value.substring(0, CHARACTER_LIMIT);
            if (text.length > 0) {
                socket.emit('update typing', { id: currentMessageId, text: text });
            }
        }, 100);
    });

    // Finalize typing and enforce character limit on keyup
    messageInput.addEventListener('keyup', () => {
        const text = messageInput.value;

        // Enforce character limit
        if (text.length > CHARACTER_LIMIT) {
            messageInput.value = text.substring(0, CHARACTER_LIMIT);
        }

        updateCharacterCount();

        // Stop typing when no keys are pressed
        if (text.length === 0 && isTyping) {
            socket.emit('stop typing', { id: currentMessageId });
            clearInterval(typingInterval);
            currentMessageId = null;
            isTyping = false;
        }
    });

    // Function to update the character count display
    function updateCharacterCount() {
        const currentLength = messageInput.value.length;
        characterCount.textContent = `${currentLength}/${CHARACTER_LIMIT}`;
    }

    function generateTripcode(password) {
        const hash = CryptoJS.SHA256(password).toString();
        return hash.substring(0, 6);
    }

    function displayMessage(msg) {
        if (msg.status === 'in-progress') {
            return;
        }

        const messageElement = createMessageElement(msg.id, msg.username, replaceEmojiSyntax(msg.text), 'finalized', msg.timestamp);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function createMessageElement(id, username, text, status, timestamp = null) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.id = `msg-${id}`;

        let timeString = '';
        if (timestamp) {
            timeString = `<small>[${new Date(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}] </small>`;
        }

        messageElement.innerHTML = `
            ${timeString}<strong>${username}</strong>: <span class="text">${text}</span> ${status === 'in-progress' ? '<em>...</em>' : ''}
        `;

        messageElement.classList.add(status === 'in-progress' ? 'message-in-progress' : 'message-finalized');

        return messageElement;
    }

    function generateUniqueId() {
        return 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
});
