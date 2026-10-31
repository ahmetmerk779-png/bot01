const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mc = require('minecraft-protocol');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());

const bots = new Map();

function getRandomName() {
    const adjectives = ['Pro', 'Epic', 'Ninja', 'Shadow', 'Fast', 'Dark', 'Cyber', 'Mega', 'Hyper', 'Super'];
    const nouns = ['Player', 'Gamer', 'Bot', 'Hero', 'Warrior', 'Mage', 'Ghost', 'Knight', 'Slayer', 'Legend'];
    const randNum = Math.floor(Math.random() * 90000) + 10000;
    return adjectives[Math.floor(Math.random() * adjectives.length)] + 
           nouns[Math.floor(Math.random() * nouns.length)] + 
           randNum;
}

io.on('connection', (socket) => {
    console.log('Bir kullanıcı panele bağlandı.');

    socket.emit('update-bots', Array.from(bots.values()).map(b => ({ id: b.id, username: b.username, status: b.status })));

    socket.on('spawn-bots', (data) => {
        const { host, port, version, count } = data;
        const parsedPort = parseInt(port) || 25565;
        const botCount = parseInt(count) || 1;

        for (let i = 0; i < botCount; i++) {
            const username = getRandomName();
            const botId = Math.random().toString(36).substring(7);

            try {
                const client = mc.createClient({
                    host: host,
                    port: parsedPort,
                    username: username,
                    version: version || false,
                    skipCache: true
                });

                bots.set(botId, { id: botId, username, client, status: 'Bağlanıyor...' });
                broadcastBots();

                client.on('connect', () => {
                    if (bots.has(botId)) {
                        bots.get(botId).status = 'Oyunda (Sunucuda)';
                        broadcastBots();
                    }
                });

                client.on('end', (reason) => {
                    if (bots.has(botId)) {
                        bots.get(botId).status = `Çıktı: ${reason || 'Bilinmiyor'}`;
                        broadcastBots();
                    }
                });

                client.on('error', (err) => {
                    if (bots.has(botId)) {
                        bots.get(botId).status = `Hata: ${err.message}`;
                        broadcastBots();
                    }
                });

            } catch (e) {
                console.error(e);
            }
        }
    });

    socket.on('disconnect-bot', (botId) => {
        if (bots.has(botId)) {
            const bot = bots.get(botId);
            try { bot.client.end(); } catch (e) {}
            bots.delete(botId);
            broadcastBots();
        }
    });

    socket.on('disconnect-all', () => {
        for (let [botId, bot] of bots) {
            try { bot.client.end(); } catch (e) {}
        }
        bots.clear();
        broadcastBots();
    });
});

function broadcastBots() {
    const list = Array.from(bots.values()).map(b => ({ id: b.id, username: b.username, status: b.status }));
    io.emit('update-bots', list);
}

server.listen(3000, () => {
    console.log('Dashboard aktif: http://localhost:3000 adresinden erişebilirsin.');
});
