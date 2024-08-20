const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Jalur absolut ke file memory.json
const dataFilePath = '/storage/emulated/0/ibu/memory.json';

// Membaca data dari file
let data;
try {
    if (fs.existsSync(dataFilePath)) {
        data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
        console.log('Data berhasil dibaca dari file.');
    } else {
        data = { conversations: {}, patterns: [] };
        console.log('File tidak ditemukan, inisialisasi data baru.');
    }
} catch (error) {
    console.error("Gagal membaca atau mengurai file memory.json:", error);
    data = { conversations: {}, patterns: [] };
}

// Fungsi untuk menyimpan percakapan
function saveConversation(userId, messageContent, responseContent) {
    if (!data.conversations) data.conversations = {};
    if (!data.conversations[userId]) data.conversations[userId] = [];

    data.conversations[userId].push({ message: messageContent, response: responseContent });
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    console.log(`Percakapan disimpan untuk userId: ${userId}`);
}

// Fungsi untuk menentukan respons berdasarkan pola
function determineResponse(messageContent) {
    if (data.patterns) {
        for (const rule of data.patterns) {
            const regex = new RegExp(rule.pattern, 'i'); // Case-insensitive
            if (regex.test(messageContent)) {
                console.log(`Pola cocok ditemukan: ${rule.pattern}`);
                return rule.response;
            }
        }
    }
    console.log('Tidak ada pola yang cocok.');
    return null; // Jika tidak ada pola yang cocok, kembalikan null
}

// Fungsi untuk memperbarui pola
function updatePatterns(userMessage, userResponse) {
    if (!data.patterns) data.patterns = [];
    const newPattern = {
        pattern: userMessage.replace(/\s+/g, '\\s*'), // Menambahkan spasi opsional untuk fleksibilitas
        response: userResponse
    };
    data.patterns.push(newPattern);
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    console.log(`Pola baru disimpan: ${userMessage} => ${userResponse}`);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.on('messageCreate', async message => {
    console.log(`Pesan diterima: ${message.content}`);
    if (message.author.bot) {
        console.log('Pesan dari bot, diabaikan.');
        return;
    }

    const userMessage = message.content.toLowerCase();
    console.log(`Pesan diproses menjadi: ${userMessage}`);

    // Perintah untuk menghapus semua pesan di channel
    if (userMessage === '&hapus') {
        console.log('Menghapus semua pesan di channel...');
        try {
            let fetchedMessages;
            do {
                fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
                await message.channel.bulkDelete(fetchedMessages, true);
            } while (fetchedMessages.size >= 2); // Lanjutkan sampai semua pesan terhapus

            console.log('Berhasil menghapus semua pesan di channel.');
            return;
        } catch (error) {
            console.error('Gagal menghapus pesan:', error);
            message.channel.send('Terjadi kesalahan saat menghapus pesan.');
            return;
        }
    }

    // Perintah untuk menghapus pesan terakhir (jika tidak semua)
    if (userMessage === 'hapus') {
        console.log('Menghapus pesan...');
        try {
            const fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
            await message.channel.bulkDelete(fetchedMessages, true);
            console.log('Berhasil menghapus pesan.');
        } catch (error) {
            console.error('Gagal menghapus pesan:', error);
        }
        return;
    }

    let response = determineResponse(userMessage);

    // Jika bot tidak mengenali pesan, minta pengguna untuk memberikan jawaban
    if (!response) {
        message.channel.send("Saya belum tahu tentang ini. Bagaimana sebaiknya saya menjawab?");
        saveConversation(message.author.id, userMessage, "Belum ada jawaban");

        const filter = response => response.author.id === message.author.id;
        const collector = message.channel.createMessageCollector({ filter, max: 1, time: 30000 }); // 30 detik

        collector.on('collect', collected => {
            const userResponse = collected.content;
            updatePatterns(userMessage, userResponse);
            
            // Hapus atau komentari baris berikut jika tidak ingin ada konfirmasi
            // message.channel.send(`Terima kasih! Saya akan ingat ini: ${userMessage} => ${userResponse}`);
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                message.channel.send("Tidak ada jawaban yang diberikan, pola tidak akan disimpan.");
                console.log('Tidak ada jawaban yang diberikan, pola tidak disimpan.');
            }
        });

        return;
    }

    // Jika bot mengenali pola, kirim respons dan simpan percakapan
    message.channel.send(response);
    console.log(`Respons dikirim: ${response}`);
    saveConversation(message.author.id, userMessage, response);
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Ganti 'your-token-here' dengan token bot yang benar
client.login('MTI3Mzg2NDk0MTI2MjM0NDMwOQ.GXzVoT.KrThVREHSdYD4J2c9fHkNHCVytvdLGjbP-IEjE');