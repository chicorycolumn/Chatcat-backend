const utils = require("./utils/utils.js");
const app = require("express")();
const cors = require("cors");
const port = process.env.PORT || 4002;
const index = require("./routes/index");

app.use(cors());
app.use(index);

const options = {
  cors: {
    origin: port,
    methods: ["GET", "POST"],
  },
};
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, options);

httpServer.listen(port, () => console.log(`Listening on port ${port}`));

const rooms = [];

class Room {
  constructor(roomName, players, questions) {
    this.roomName = roomName;
    this.players = players || [];
    this.questions = questions || ["What's your favourite colour?"];
  }
}

class Player {
  constructor(socketId, playerName, points) {
    this.socketId = socketId;
    this.playerName = playerName;
    this.points = points || 0;
  }
}

io.on("connection", (socket) => {
  let player = new Player(socket.id, socket.id.slice(0, 5));

  console.log(
    `Socket ${socket.id.slice(
      0,
      5
    )} connected at ${new Date().toUTCString().slice(17, -4)}.`
  );

  socket.on("disconnect", (data) => {
    console.log(
      `Socket ${socket.id.slice(
        0,
        5
      )} disconnected at ${new Date().toUTCString().slice(17, -4)}.`
    );
    makePlayerLeaveRoom(socket, data);
  });

  socket.on("Dev query rooms", function (data) {
    console.log("Dev asked to query rooms.");
    socket.emit("Dev queried rooms", {
      roomList: rooms,
    });
  });

  socket.on("Hello to all", function (data) {
    let senderId = socket.id;
    let room = rooms.find((room) =>
      room.players.find((roomPlayer) => roomPlayer.socketId === senderId)
    );
    let msg = `Hello to all from ${senderId.slice(0, 5)}.`;

    if (room) {
      console.log(msg);
      io.in(room.roomName).emit("Hello to all", { msg });
    } else {
      console.log(`Found no room for ${senderId.slice(0, 5)}!`);
    }
  });

  socket.on("Create room", function (data) {
    console.log(`Let us create a room called "${data.roomName}"`);

    if (rooms.find((room) => room.roomName === data.roomName)) {
      socket.emit("Room not created", { message: "Room already exists." });
      return;
    }

    let room = new Room(data.roomName);
    rooms.push(room);
    socket.emit("Room created", { roomName: data.roomName });
  });

  socket.on("Request entry", function (data) {
    console.log(
      `Socket ${socket.id.slice(0, 5)} wants to enter room "${data.roomName}".`
    );

    let room = rooms.find((room) => room.roomName === data.roomName);

    if (!room) {
      console.log("Room not found!");
      socket.emit("Entry denied", { message: "Room not found." });
      return;
    }

    if (
      room.players.find((roomPlayer) => roomPlayer.socketId === player.socketId)
    ) {
      console.log(`${socket.id.slice(0, 5)} already in ${room.roomName}.`);
      return;
    }

    console.log(
      `Socket ${socket.id.slice(0, 5)} has entered room ${room.roomName}.`
    );
    room.players.push(player);
    console.log("rooms", rooms);
    socket.join(room.roomName);
    socket.emit("Entry granted", {
      roomName: room.roomName,
      roomData: room,
    });
    socket.to(room.roomName).emit("Player entered your room", {
      playerId: socket.id,
      roomData: room,
    });
  });

  socket.on("Leave room", function (data) {
    console.log("Leave room");
    makePlayerLeaveRoom(socket, data);
  });

  function makePlayerLeaveRoom(socket, data) {
    console.log("J22", { socketId: socket.id, roomName: data.roomName });

    let room = rooms.find((room) => room.roomName === data.roomName);

    if (!room) {
      console.log("clause1", room);
      rooms.forEach((roo) => {
        console.log(
          roo.roomName,
          roo.players.map((rooPlayer) => rooPlayer.socketId)
        );
      });

      room = rooms.find((roo) =>
        roo.players.map((rooPlayer) => rooPlayer.socketId === socket.id)
      );

      console.log("clause2", room);
    }

    if (!room) {
      console.log(
        `Socket ${socket.id.slice(0, 5)} asked to leave room ${
          data.roomName
        } but no such room exists.`
      );
      return;
    }

    console.log(
      `Socket ${socket.id.slice(0, 5)} is leaving room ${room.roomName}`
    );
    room.players = room.players.filter(
      (roomPlayer) => roomPlayer.socketId !== player.socketId
    );
    socket.to(room.roomName).emit("Player left your room", {
      playerId: socket.id,
      roomData: room,
    });
    socket.leave(room.roomName);
  }
});
