const app = require("express")();
const cors = require("cors");
const port = process.env.PORT || 4002;
const index = require("./routes/index");
const { Player, Room } = require("./utils/classes.js");
const aUtils = require("./utils/aUtils.js");

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
let players = [];

io.on("connection", (socket) => {
  console.log(
    `Socket ${socket.id.slice(
      0,
      4
    )} connected at ${new Date().toUTCString().slice(17, -4)}.`
  );

  let player;

  socket.on("Load player", function (data) {
    if (data.truePlayerName) {
      player = players.find(
        (playe) => playe.truePlayerName === data.truePlayerName
      );
    }

    if (player) {
      player.socketId = socket.id;
    } else {
      player = new Player(aUtils.randomString(16), socket.id);
    }

    players.push(player);

    console.log("I made a player and am about to send it:", player);

    socket.emit("Player loaded", { player });
  });

  socket.on("Update player data", function (data) {
    if (!data.player) {
      console.log("L31 You want to update player with nothing?");
      return;
    }

    console.log("Updating player data", data.player);
    Object.keys(data.player).forEach((k) => {
      let v = data.player[k];
      player[k] = v;
    });

    socket.emit("Player loaded", { player });
  });

  socket.on("disconnecting", (data) => {
    console.log(
      `Socket ${socket.id.slice(
        0,
        4
      )} disconnectING at ${new Date().toUTCString().slice(17, -4)}.`
    );
    makePlayerLeaveRoom(socket, player, data);
  });

  socket.on("disconnect", (data) => {
    console.log(
      `Socket ${socket.id.slice(
        0,
        4
      )} disconnectED at ${new Date().toUTCString().slice(17, -4)}.`
    );
    makePlayerLeaveRoom(socket, player, data);
  });

  socket.on("Dev query", function (data) {
    console.log("Dev asked to query data.");
    socket.emit("Dev queried", {
      rooms: rooms,
      player: player,
      players: players,
    });
  });

  function roomsBySocket() {
    return [...io.sockets.adapter.rooms.entries()];
  }

  function roomNameBySocket(socket) {
    let roomNameObj = roomsBySocket().find(
      (subArr) => subArr[0] !== socket.id && subArr[1].has(socket.id)
    );
    return roomNameObj ? roomNameObj[0] : null;
  }

  socket.on("Chat message", function (data) {
    console.log("Received chat message.");
    let roomName = roomNameBySocket(socket);

    if (!roomName) {
      console.log("None such.");
      return;
    }

    let room = rooms.find((roo) => roo.roomName === roomName);

    if (!room) {
      console.log("No such room to emit chat message to.");
      return;
    }

    data.sender = player.trim();
    console.log("Sending chat message.");
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

    makePlayerEnterRoom(socket, player, data.playerName, room, data.roomName);
  });

  socket.on("Request entry", function (data) {
    makePlayerEnterRoom(socket, player, data.playerName, null, data.roomName);
  });

  socket.on("Request room data", function (data) {
    let room = rooms.find((roo) => roo.roomName === data.roomName);

    if (!room) {
      console.log("No room found.");
      return;
    }

    if (!room.players.find((roomPlayer) => roomPlayer.socketId === socket.id)) {
      console.log(
        `${socket.id.slice(0, 4)} requested room data for ${
          room.roomName
        } but she isn't in this room.`
      );
      return;
    }

    socket.emit("Room data", { room: room.trim() });
  });

  socket.on("Leave room", function (data) {
    makePlayerLeaveRoom(socket, player, data);
  });

  socket.on("Give stars", function (data) {
    let roomName = roomNameBySocket(socket);

    if (!roomName) {
      console.log("None such.");
      return;
    }

    let room = rooms.find((roo) => roo.roomName === roomName);

    let playerToStar = room.players.find(
      (roomPlayer) => roomPlayer.playerName === data.playerNameToStar
    );

    if (playerToStar) {
      playerToStar.stars += data.starIncrement;

      updatePlayersWithRoomData(roomName);
    }
  });
});

function updatePlayersWithRoomData(roomName, room) {
  if (!roomName) {
    console.log("L51");
    return;
  }

  if (!room) {
    room = rooms.find((roo) => roo.roomName === roomName);
  }

  io.in(roomName).emit("Room data", { room: room.trim() });
}

function makePlayerEnterRoom(socket, player, playerName, room, roomName) {
  console.log(
    `Socket ${socket.id.slice(0, 4)} wants to enter room "${roomName}".`
  );

  setPlayerName(player, playerName);

  if (!room) {
    room = rooms.find((room) => room.roomName === roomName);
  }

  if (!room) {
    console.log("Room not found!");
    socket.emit("Entry denied", { msg: `Room ${roomName} not found.` });
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
    room: room.trim(),
  });
  socket.to(room.roomName).emit("Player entered your room", {
    player: player.trim(),
    room: room.trim(),
  });
}

function setPlayerName(player, playerName) {
  player.playerName = playerName;
}

function makePlayerLeaveRoom(socket, player, data) {
  console.log("Leave room");

  if (!player) {
    console.log(`makePlayerLeaveRoom sees that player is undefined.`);
    return;
  }

  let { playerName } = player;

  let room = rooms.find((roo) => roo.roomName === data.roomName);

  if (!room) {
    room = rooms.find((roo) =>
      roo.players.find((rooPlayer) => rooPlayer.socketId === socket.id)
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

  if (!room.players.find((roomPlayer) => roomPlayer.socketId === socket.id)) {
    console.log(`${socket.id.slice(5)} not in ${room ? room.roomName : room}`);
    return;
  }

  console.log(
    `Socket ${socket.id.slice(0, 4)} is leaving room ${room.roomName}`
  );
  room.players = room.players.filter(
    (roomPlayer) => roomPlayer.socketId !== player.socketId
  );
  socket.to(room.roomName).emit("Player left your room", {
    player: { playerName },
    room: room.trim(),
  });
  socket.leave(room.roomName);

  if (!room.players.length) {
    console.log(`Deleting room ${room.roomName}.`);
    rooms = rooms.filter((roo) => roo.roomName !== room.roomName);
  }
}
