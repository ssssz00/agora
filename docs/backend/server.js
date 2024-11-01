require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const sanitizeHtml = require('sanitize-html');

// Environment Variables
const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

// Initialize Express App
const app = express();

// Serve Static Files from Frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve emojis folder as a static route
app.use('/_emojis', express.static(path.join(__dirname, '../_emojis')));

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*", // Update this in production for security
        methods: ["GET", "POST"]
    }
});

// Initialize Redis Clients for Adapter
const pubClient = createClient({
    socket: { host: REDIS_HOST, port: REDIS_PORT },
    password: REDIS_PASSWORD
});

const subClient = pubClient.duplicate();

// Rate limiting map
const rateLimitMap = new Map();
const connectedUsers = {}; // Track connected users by socket ID

// Connect Redis Clients
(async () => {
    try {
        await pubClient.connect();
        await subClient.connect();
        console.log('Connected to Redis');

        // Use Redis Adapter after successful connection
        io.adapter(createAdapter(pubClient, subClient));

        io.on('connection', async (socket) => {
            console.log(`User connected: ${socket.id}`);

            // Retrieve the last 500 messages from Redis and send to the client
            try {
                const messages = await pubClient.lRange('messages', 0, -1);
                socket.emit('previous messages', messages);
            } catch (err) {
                console.error('Error retrieving messages:', err);
            }

            // Listen for user registration
            socket.on('register user', (username) => {
                connectedUsers[socket.id] = username;
                io.emit('user list', Object.values(connectedUsers)); // Send updated user list to all clients
            });

            // Listen for chat messages
            socket.on('chat message', async (msg) => {
                msg.text = sanitizeHtml(msg.text); // Sanitize incoming message
                msg.id = uuidv4();
                msg.serverTimestamp = new Date().toISOString();
                msg.status = 'finalized';

                // Rate limiting
                const lastMessageTime = rateLimitMap.get(socket.id) || 0;
                if (Date.now() - lastMessageTime < 1000) {
                    return; // Ignore message if sent too quickly
                }
                rateLimitMap.set(socket.id, Date.now());

                // Store message in Redis and broadcast
                await pubClient.rPush('messages', JSON.stringify(msg));
                await pubClient.lTrim('messages', -500, -1);
                io.emit('chat message', msg);
            });

            // Handle typing events
            socket.on('start typing', (data) => {
                io.emit('user typing', { id: data.id, username: data.username });
            });

            socket.on('update typing', (data) => {
                io.emit('update typing', { id: data.id, text: data.text });
            });

            socket.on('stop typing', (data) => {
                io.emit('stop typing', { id: data.id });
            });

            // Handle user disconnect
            socket.on('disconnect', () => {
                delete connectedUsers[socket.id];
                io.emit('user list', Object.values(connectedUsers)); // Send updated user list to all clients
                console.log(`User disconnected: ${socket.id}`);
            });
        });

        // Start the Server
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Redis Client Error:', err);
        process.exit(1);
    }
})();