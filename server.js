const express = require("express");
const http = require("http");
const socketio = require("socket.io");

const { runCommand } = require("./commands"); // ← assure-toi que le chemin est correct

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static("public")); // ton dossier avec chatsmo.html

io.on("connection", (socket) => {
    console.log("Client connected");

    socket.on("sendMessage", async (msg) => {
        const message = {
            content: msg,
            author: socket.id
        };

        // runCommand prend message et une fonction de callback
        await runCommand(message, (response) => {
            socket.emit("receiveMessage", response);
        });
    });
});

server.listen(3000, () => console.log("Server running on port 3000"));
