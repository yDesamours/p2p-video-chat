// require("dotenv").config;
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const path = require("path");

const app = express();
const httpserver = http.Server(app);
const io = socketio(httpserver, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const port = process.env.port || 80;
const gamedirectory = path.join(__dirname, "dist");

app.use(express.static(gamedirectory));

var rooms = {};

io.on("connection", function (socket) {
  console.log("new connection");

  socket.on("disconnect", () => {
    io.in(socket.data.room).emit("disconnection", { peerSocketId: socket.id });
    socket.leaveAll();
    console.log("Socket disconnected:");
  });

  socket.on("join", function ({ room, username }, callback) {
    console.log("joining room");

    const clients = io.sockets.adapter.rooms.get(room);
    if (clients && clients.size > 1) {
      callback({ success: false, msg: "room is full" });
      return;
    }

    io.in(room).emit("peerReadyToConnect", {
      peerSocketId: socket.id,
      username: username,
    });

    socket.leaveAll();
    socket.data.username = username;
    socket.data.room = room;
    socket.join(room);

    callback({ success: true });
  });

  socket.on("leave", function (callback) {
    console.log("leaving room");

    rooms[socket.id] = room;
    io.in(room).emit("peerReadyToConnect", {
      peerSocketId: socket.id,
      username: username,
    });

    socket.leaveAll();
    socket.data.username = username;
    socket.join(room);
    const clients = io.sockets.adapter.rooms.get(room);

    callback({ success: true, participants: Array.from(clients) });
  });

  socket.on("offer", function (payload, callback) {
    console.log("offer received", payload.type);
    const to = io.sockets.sockets.get(payload.receiver);
    if (to === undefined) {
      console.log("receiver not found");
      return;
    }

    to.emit("offer", {
      data: payload.data,
      peerSocketId: socket.id,
      username: socket.data.username,
    });
    callback({ success: true });
  });

  socket.on("answer", function (answer, callback) {
    console.log("answer received");

    const to = io.sockets.sockets.get(answer.receiver);
    if (!to) {
      return;
    }

    to.emit("answer", { data: answer.data, peerSocketId: socket.id });
    callback({ success: true });
  });

  socket.on("ice-candidate", function (candidate, callback) {
    console.log("candidate received");
    const to = io.sockets.sockets.get(candidate.receiver);

    if (!to) {
      return;
    }

    to.emit("ice-candidate", { data: candidate.data, peerSocketId: socket.id });
    callback({ success: true });
  });

  socket.on("screenSharing", function (receiver, callback) {
    console.log("sreen sharing begin");
    if (receiver) {
      const to = io.sockets.sockets.get(receiver.receiver);
      if (!to) {
        return;
      }
      to.emit("screenSharing", { peerSocketId: socket.id });

      return;
    }
    const room = socket.data.room;
    if (!room) {
      callback({ success: false, msg: "---" });
      return;
    }
    socket.to(room).emit("screenSharing", { peerSocketId: socket.id });
    callback({ success: true });
  });

  socket.on("screenSharingStopped", function (callback) {
    console.log("sreen sharing stopped");
    const room = socket.data.room;
    if (!room) {
      callback({ success: false, msg: "---" });
      return;
    }
    socket.to(room).emit("screenSharingStopped", { peerSocketId: socket.id });
    callback({ success: true });
  });
});

console.log("server started on port: " + port);
httpserver.listen(port);
