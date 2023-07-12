const mqtt = require("mqtt");

// const client = mqtt.connect("mqtt://127.0.0.1"); //SIMPLE MQTT CONNECTION

// PRODUCTION MQTT CONNECTTION
const client = mqtt.connect(
    `mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`,
    {
        clean: true,
        connectTimeout: 4000,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        reconnectPeriod: 1000,
    }
);

module.exports = client;
