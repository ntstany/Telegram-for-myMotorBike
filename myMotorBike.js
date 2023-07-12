require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const mqtt = require("./connection/defineMqtt");
const axios = require("axios");
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

const OWNER = {
    chatId: 922125061,
    cardUID: "90baac20",
};

// Variabel untuk menghitung percobaan kartu yang salah
let failedAttempts = 0;

// Handler saat bot menerima perintah /start
bot.start((ctx) => {
    ctx.reply("Selamat datang! Bot myMotorBike telah diaktifkan", {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "Panduan kunci dan starter",
                        callback_data: "keyless_guide",
                    },
                    {
                        text: "Deteksi lokasi",
                        callback_data: "detect_location",
                    },
                ],
            ],
        },
    });
});

// Handler untuk inline button "Panduan kunci dan stater sepeda motor"
bot.action("keyless_guide", (ctx) => {
    ctx.reply(`Panduan kunci dan starter sepeda motor (keyless system):
1. Silakan tempelkan kartu yang terdaftar pada RFID tag sepeda motor Anda untuk membuka kunci stang motor!
2. Tempel kembali kartu Anda untuk menyalakan starter motor (tap kedua)!`);
});

bot.command("lock", (ctx) => {
    // Cek status kunci dan sensor getar
    if (isMotorLocked()) {
        ctx.reply("Kunci kontak dan kunci stang telah terkunci.");
        ctx.reply("Sensor getar dalam keadaan ON.");
    } else {
        ctx.reply("Kunci kontak dan kunci stang belum terkunci.");
        ctx.reply("Sensor getar dalam keadaan OFF.");
    }
});

bot.on("text", (ctx) => {
    const uid = ctx.message.text; // Mendapatkan UID kartu RFID dari pesan teks yang diterima

    // Cek UID kartu dengan yang tersimpan di EEPROM ESP32
    if (checkRFID(uid)) {
        // UID kartu terdaftar
        if (failedAttempts >= 3) {
            // Reset percobaan kartu yang salah setelah diblokir selama 5 menit
            setTimeout(() => {
                failedAttempts = 0;
            }, 5 * 60 * 1000); // Waktu dalam milidetik (5 menit)

            ctx.reply("Sistem keyless telah diblokir selama 5 menit.");
        }

        if (failedAttempts < 3) {
            // Kartu terdaftar, kunci stang dan kelistrikan motor dalam keadaan ON, sensor getar dalam keadaan OFF
            ctx.reply("Kunci stang dan kelistrikan motor dalam keadaan ON.");
            ctx.reply("Sensor getar dalam keadaan OFF.");
        }
    } else {
        // UID kartu tidak terdaftar
        failedAttempts++;

        if (failedAttempts >= 3) {
            ctx.reply(
                "Percobaan kartu yang salah telah mencapai batas. Sistem keyless diblokir selama 5 menit."
            );
        } else {
            ctx.reply("Akses ditolak. Kartu tidak terdaftar.");
        }
    }
});

// Callback handler untuk getaran terdeteksi
bot.on("callback_query", (ctx) => {
    if (ctx.callbackQuery.data === "vibration_detected") {
        // TODO: Kontrol ESP32 untuk mendeteksi getaran

        ctx.reply(
            "Pertanda bahaya dan pergerakan yang mencurigakan terdeteksi!"
        );

        ctx.reply(
            "Apakah Anda ingin mendeteksi lokasi sepeda motor?",
            Markup.inlineKeyboard([
                Markup.button.callback("Ya", "detect_location"),
                Markup.button.callback("Tidak", "cancel_location_detection"),
            ]).extra()
        );
    }

    if (ctx.callbackQuery.data === "detect_location") {
        // TODO: Kirim permintaan ke ESP32 untuk mendapatkan titik koordinat kendaraan
        const latitude = 0; // Ganti dengan nilai latitude yang valid
        const longitude = 0; // Ganti dengan nilai longitude yang valid

        // KIRIM DATA MQTT KE GATEWAY
        mqtt.publish("detect_location", "GET LOCATION");
        console.log("DETEKSI LOKASI");

        ctx.reply(`Data anda sedang di proses, mohon bersabar untuk menunggu`);
    }

    if (ctx.callbackQuery.data === "matikan_alarm") {
        // KIRIM DATA MQTT KE GATEWAY
        mqtt.publish("update_alarm", "TURN OFF ALARM");
        ctx.editMessageText(`Alarm anda kami matikan`);
    }
});

// Callback handler untuk membatalkan deteksi lokasi kendaraan
bot.action("cancel_location_detection", (ctx) => {
    ctx.reply("Deteksi lokasi kendaraan dibatalkan.");
});

// Fungsi untuk memeriksa UID kartu RFID dengan yang tersimpan di EEPROM ESP32
function checkRFID(uid) {
    // Implementasikan logika pengecekan UID kartu di EEPROM ESP32
    // Return true jika UID kartu terdaftar, dan false jika tidak terdaftar
    // Misalnya:
    const registeredUIDs = ["UID1", "UID2", "UID3"]; // Daftar UID kartu yang terdaftar

    return registeredUIDs.includes(uid);
}

// Fungsi untuk memeriksa status kunci dan sensor getar
function isMotorLocked() {
    // Implementasikan logika pengecekan status kunci dan sensor getar di ESP32
    // Return true jika kunci terkunci dan sensor getar aktif, dan false jika tidak
    // Misalnya:
    const isLocked = true;
    const isVibrationDetected = false;

    return isLocked && !isVibrationDetected;
}

bot.launch();
console.log("Bot is running...");

// ------------------------------------
// MQTT HANDLER
// ------------------------------------

// MQTT TOPIC LIST
const topicLocataionUpdate = "location-update"; // PESAN YANG HARUS DIKIRIM ==> LAT#LONG
const motionDetected = "motion-update"; //PESAN YANG HARUS DIKIRIM ==> APA AJA ASAL STRING
const accessUpdate = "access-update"; //PESAN YANG HARUS DIKIRIM ==> APA AJA ASAL STRING

// SUBSCRIBE KE TOPIC
mqtt.subscribe(topicLocataionUpdate, () => {
    console.log(`MQTT SUBSRIBE TO "${topicLocataionUpdate}"`);
});

mqtt.subscribe(motionDetected, () => {
    console.log(`MQTT SUBSRIBE TO "${motionDetected}"`);
});

mqtt.subscribe(accessUpdate, () => {
    console.log(`MQTT SUBSRIBE TO "${accessUpdate}"`);
});

// JIKA ADA PESAN PADA TOPIC YANG DI SUBSCRIBE
mqtt.on("message", function (topic, message) {
    // JIKA UPDATE LOKASI
    if (topic === topicLocataionUpdate) {
        const [lat, long] = message.toString().split("#");

        const locationUrl = `https://www.google.com/maps?q=${lat},${long}`;
        console.log("LOKASI TERKINI: ", locationUrl);
        bot.telegram.sendMessage(
            OWNER.chatId,
            `Lokasi Kendaraan Anda: ${locationUrl}`
        );
    }

    // JIKA TERDAPAT GERAKAN
    if (topic === motionDetected) {
        bot.telegram.sendMessage(
            OWNER.chatId,
            `${message.toString()}\n\nMatikan Alarm`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Matikan Alarm",
                                callback_data: "matikan_alarm",
                            },
                        ],
                    ],
                },
            }
        );
    }

    // JIKA 3 KALI SALAH KARTU atau BERHASIL
    if (topic === accessUpdate) {
        bot.telegram.sendMessage(OWNER.chatId, message.toString());
    }
});
