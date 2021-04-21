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

let rooms = [];

function trimmedPlayer(original) {
  let newObj = {};
  let publicProperties = ["socketId", "playerName"];
  publicProperties.forEach((property) => {
    newObj[property] = original[property];
  });
  return newObj;
}

function trimmedRoom(original) {
  let newObj = {};
  let publicProperties = ["roomName"];
  publicProperties.forEach((property) => {
    newObj[property] = original[property];
  });
  newObj["players"] = original.players.map((roomPlayer) =>
    trimmedPlayer(roomPlayer)
  );
  return newObj;
}

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
  let player = new Player(socket.id);

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
    makePlayerLeaveRoom(socket, player, data);
  });

  socket.on("Dev query rooms", function (data) {
    console.log("Dev asked to query rooms.");
    socket.emit("Dev queried rooms", {
      rooms: rooms.map((room) => trimmedRoom(room)),
    });
  });

  function roomsBySocket() {
    return [...io.sockets.adapter.rooms.entries()];
  }

  socket.on("Chat message", function (data) {
    let roomName = roomsBySocket().find(
      (subArr) => subArr[0] !== socket.id && subArr[1].has(socket.id)
    )[0];

    let room = rooms.find((roo) => roo.roomName === roomName);

    if (!room) {
      console.log("No such room to emit chat message to.");
      return;
    }

    data.sender = trimmedPlayer(player);

    io.in(room.roomName).emit("Chat message", data);
  });

  socket.on("Hello to all", function (data) {
    let senderId = socket.id;
    let room = rooms.find((room) =>
      room.players.find((roomPlayer) => roomPlayer.socketId === senderId)
    );
    let msg = `Hello to all ${room.roomName}-ers from ${senderId.slice(0, 4)}.`;

    if (room) {
      console.log(msg);
      io.in(room.roomName).emit("Hello to all", { msg });
    } else {
      console.log(`Found no room for ${senderId.slice(0, 4)}!`);
    }
  });

  socket.on("Create room", function (data) {
    console.log(`Let us create a room called "${data.roomName}"`);

    if (rooms.find((room) => room.roomName === data.roomName)) {
      socket.emit("Room not created", {
        msg: `Room ${data.roomName} already exists.`,
      });
      return;
    }

    let room = new Room(data.roomName);
    rooms.push(room);
    socket.emit("Room created", { room: trimmedRoom(room) });
  });

  socket.on("Request entry", function (data) {
    console.log(
      `Socket ${socket.id.slice(0, 4)} wants to enter room "${data.roomName}".`
    );

    setPlayerName(player, data.playerName);

    let room = rooms.find((room) => room.roomName === data.roomName);

    if (!room) {
      console.log("Room not found!");
      socket.emit("Entry denied", { msg: `Room ${data.roomName} not found.` });
      return;
    }

    if (
      room.players.find((roomPlayer) => roomPlayer.socketId === player.socketId)
    ) {
      console.log(`${socket.id.slice(0, 4)} already in ${room.roomName}.`);
      return;
    }

    console.log(
      `Socket ${socket.id.slice(0, 4)} has entered room ${room.roomName}.`
    );
    room.players.push(player);
    socket.join(room.roomName);
    socket.emit("Entry granted", {
      room: trimmedRoom(room),
    });
    socket.to(room.roomName).emit("Player entered your room", {
      player: trimmedPlayer(player),
      room: trimmedRoom(room),
    });
  });

  socket.on("Leave room", function (data) {
    console.log("Leave room");
    makePlayerLeaveRoom(socket, player, data);
  });
});

function setPlayerName(player, playerName) {
  player.playerName = playerName;
}

function makePlayerLeaveRoom(socket, player, data) {
  let room = rooms.find((room) => room.roomName === data.roomName);

  if (!room) {
    room = rooms.find((roo) =>
      roo.players.map((rooPlayer) => rooPlayer.socketId === socket.id)
    );
  }

  if (!room) {
    console.log(
      `Socket ${socket.id.slice(0, 4)} asked to leave room ${
        data.roomName
      } but no such room exists.`
    );
    return;
  }

  console.log(
    `Socket ${socket.id.slice(0, 4)} is leaving room ${room.roomName}`
  );
  room.players = room.players.filter(
    (roomPlayer) => roomPlayer.socketId !== player.socketId
  );
  socket.to(room.roomName).emit("Player left your room", {
    player: trimmedPlayer(player),
    room: trimmedRoom(room),
  });
  socket.leave(room.roomName);

  if (!room.players.length) {
    console.log(`Deleting room ${room.roomName}.`);
    rooms = rooms.filter((roo) => roo.roomName !== room.roomName);
  }
}
