require('dotenv').config();
const mineflayer = require('mineflayer');
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// ==========================================
// 1. TẠO WEB SERVER CHO RENDER (GIỮ BOT ONLINE)
// ==========================================
const app = express();
app.get('/', (req, res) => res.send('Bot Minecraft đang hoạt động 24/24!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Web] Đang chạy trên port ${PORT}`));

// ==========================================
// 2. BIẾN TOÀN CỤC & TRẠNG THÁI
// ==========================================
let autoSleepEnabled = true; 
let lastAnnouncedDay = -1;
let bot;

// ==========================================
// 3. CẤU HÌNH DISCORD BOT
// ==========================================
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

discordClient.once('ready', () => {
    console.log(`[Discord] Bot đã online với tên: ${discordClient.user.tag}`);
});

discordClient.login(process.env.DISCORD_TOKEN);

// ==========================================
// 4. CẤU HÌNH MINEFLAYER BOT
// ==========================================
function initBot() {
    bot = mineflayer.createBot({
        host: process.env.MC_HOST,
        port: parseInt(process.env.MC_PORT) || 25565,
        username: process.env.MC_USER,
        version:'1.20.1',
        realVersion: '1.20.1'
    });

    bot.on('spawn', () => {
        console.log('[MC] Bot đã vào server Minecraft!');
    });

    // ---------------------------------------------------------
    // A. NHẬN TIN NHẮN TỪ MC -> CHUYỂN SANG DISCORD
    // ---------------------------------------------------------
    bot.on('chat', (username, message) => {
        if (username === bot.username) return; 

        if (message.trim() === '!autosleep on') {
            autoSleepEnabled = true;
            bot.chat('Đã BẬT tự động ngủ qua ngày.');
            return;
        }
        if (message.trim() === '!autosleep off') {
            autoSleepEnabled = false;
            bot.chat('Đã TẮT tự động ngủ qua ngày.');
            return;
        }

        const channel = discordClient.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
        if (channel) {
            channel.send(`**[Minecraft] ${username}**: ${message}`);
        }
    });

    // ---------------------------------------------------------
    // B. XỬ LÝ THỜI GIAN: NGỦ & BÁO NGÀY MỚI
    // ---------------------------------------------------------
    bot.on('time', () => {
        const currentDay = Math.floor(bot.time.age / 24000); 
        const timeOfDay = bot.time.timeOfDay;

        if (currentDay > lastAnnouncedDay && timeOfDay < 1000) {
            lastAnnouncedDay = currentDay;
            const msg = `🌅 Một ngày mới đã bắt đầu! Đã qua ${currentDay} ngày trong server.`;
            bot.chat(msg);
            
            const channel = discordClient.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
            if (channel) channel.send(`**[HỆ THỐNG MC]** ${msg}`);
        }

        if (autoSleepEnabled && timeOfDay >= 12541 && timeOfDay <= 23458) {
            if (!bot.isSleeping) {
                const bed = bot.findBlock({
                    matching: block => bot.isABed(block),
                    maxDistance: 6
                });
                
                if (bed) {
                    bot.sleep(bed).catch(() => {});
                }
            }
        }
    });

    // ---------------------------------------------------------
    // C. TỰ ĐỘNG KẾT NỐI LẠI
    // ---------------------------------------------------------
    bot.on('end', () => {
        console.log('[MC] Bot bị ngắt kết nối. Đang thử kết nối lại sau 10 giây...');
        setTimeout(initBot, 10000);
    });

    bot.on('error', (err) => {
        console.error('[MC] Lỗi bot Minecraft:', err);
    });
}

initBot();

// ==========================================
// 5. NHẬN TIN NHẮN TỪ DISCORD -> GỬI VÀO MC
// ==========================================
discordClient.on('messageCreate', (message) => {
    if (message.author.bot) return; 

    if (message.content.trim() === '!autosleep on') {
        autoSleepEnabled = true;
        message.reply('Đã BẬT tự động ngủ trong Minecraft.');
        if (bot) bot.chat('Tính năng tự động ngủ đã được BẬT từ Discord.');
        return;
    }
    if (message.content.trim() === '!autosleep off') {
        autoSleepEnabled = false;
        message.reply('Đã TẮT tự động ngủ trong Minecraft.');
        if (bot) bot.chat('Tính năng tự động ngủ đã được TẮT từ Discord.');
        return;
    }

    if (message.channel.id === process.env.DISCORD_CHANNEL_ID) {
        if (bot) {
            bot.chat(`[Discord] ${message.author.displayName}: ${message.content}`);
        }
    }
});
