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

const rooms = [];
const players = [];

// setInterval(function () {
//   console.log("--------------------");
//   console.log(players);
//   console.log("--------------------");
// }, 5000);

io.on("connection", (socket) => {
  console.log(
    `ø connection. Socket ${socket.id.slice(
      0,
      4
    )} connected at ${new Date().toUTCString().slice(17, -4)}.`
  );

  socket.on("Dev destroy all", function () {
    console.log("ø DESTROY");

    [rooms, players].forEach((arr) => {
      while (arr.length) {
        arr.pop();
      }
    });
  });

  socket.on("Dev query", function (data) {
    console.log("ø Dev query");
    console.log("players", players);
    console.log("€ Dev queried");
    socket.emit("Dev queried", {
      rooms: rooms,
      players: players,
    });
  });

  socket.on("Load player", function (data) {
    console.log("ø Load player", data);
    console.log("And just so you know, current players arr is:", players);

    let player;

    if (data.truePlayerName) {
      player = players.find(
        (playe) => playe.truePlayerName === data.truePlayerName
      );
    }

    if (player) {
      console.log(">Using extant player");
      player.socketId = socket.id;
    } else {
      console.log(">Creating new player");
      player = new Player(
        `_${aUtils.randomString(16)}`,
        socket.id,
        data.playerName
      );
      players.push(player);
    }

    console.log(
      "€ Player loaded. I created a player and am about to send it:",
      player
    );
    socket.emit("Player loaded", { player });
  });

  socket.on("Update player data", function (data) {
    console.log("ø Update player data", data);

    if (!data.player) {
      console.log("L31 You want to update player with nothing?");
      return;
    }

    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`C31 no player found.`);
      return;
    }

    console.log("Updating player data", data.player);
    Object.keys(data.player).forEach((k) => {
      let v = data.player[k];
      player[k] = v;
    });

    console.log("players arr after I updated player", players);
    console.log("€ Player loaded");
    socket.emit("Player loaded", { player });
  });

  socket.on("disconnecting", (data) => {
    console.log(
      `ø disconnecting. Socket ${socket.id.slice(
        0,
        4
      )} disconnectING at ${new Date().toUTCString().slice(17, -4)}.`
    );

    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`F11 no player found.`);
      return;
    }

    makePlayerLeaveRoom(socket, player, data);
  });

  socket.on("disconnect", (data) => {
    console.log(
      `ø disconnect Socket ${socket.id.slice(
        0,
        4
      )} disconnectED at ${new Date().toUTCString().slice(17, -4)}.`
    );
    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`B11 no player found.`);
      return;
    }

    makePlayerLeaveRoom(socket, player, data);
  });

  socket.on("Chat message", function (data) {
    console.log("ø Chat message");
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

    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`L11 no player found.`);
      return;
    }
    data.sender = player.trim();

    console.log("Sending chat message.");
    io.in(room.roomName).emit("Chat message", data);
  });

  socket.on("Create room", function (data) {
    console.log(
      `ø Create room. Let us create a room called "${data.roomName}"`
    );

    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`G11 no player found.`);
      return;
    }

    if (rooms.find((room) => room.roomName === data.roomName)) {
      console.log("€ Room not created");
      socket.emit("Room not created", {
        msg: `Room ${data.roomName} already exists.`,
      });
      return;
    }

    let room = new Room(data.roomName, data.roomPassword);
    rooms.push(room);

    makePlayerEnterRoom(socket, player, room, data.roomName, data.roomPassword);
  });

  socket.on("Request entry", function (data) {
    console.log("ø Request entry", data);
    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`C11 no player found.`);
      return;
    }

    makePlayerEnterRoom(socket, player, null, data.roomName, data.roomPassword);
  });

  socket.on("Request room data", function (data) {
    console.log("ø Request room data", data);
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
    console.log("€ Room data");
    socket.emit("Room data", { room: room.trim() });
  });

  socket.on("Leave room", function (data) {
    console.log("ø Leave room", data);
    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`W11 No player found.`);
      return;
    }
    makePlayerLeaveRoom(socket, player, data);
  });

  socket.on("Give stars", function (data) {
    console.log("ø Give stars", data);
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

  socket.on("Update room password", function (data) {
    let room = rooms.find((roo) => roo.roomName === data.roomName);

    if (!room) {
      console.log(`K21 No such room ${data.roomName}.`);
      return;
    }

    let isThisPlayerInTheRoom = room.players.find(
      (playe) => playe.socketId === socket.id
    );

    if (!isThisPlayerInTheRoom) {
      console.log(
        `K22 How can this player be asking to change ${room.roomName}'s password, when they don't appear to be in the room?`
      );
      return;
    }

    room.roomPassword = data.roomPassword;

    io.in(data.roomName).emit("Room password updated", {
      roomPassword: data.roomPassword,
      roomName: data.roomName,
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

function makePlayerEnterRoom(socket, player, room, roomName, roomPassword) {
  console.log(
    `Socket ${socket.id.slice(0, 4)} wants to enter room "${roomName}".`
  );

  if (!room) {
    room = rooms.find((room) => room.roomName === roomName);
  }

  if (!room) {
    console.log("€ Entry denied. Room not found.");
    socket.emit("Entry denied", { msg: `Room ${roomName} not found.` });
    return;
  }

  if (room.roomPassword && room.roomPassword !== roomPassword) {
    console.log("€ Entry denied. Password incorrect.");
    socket.emit("Entry denied", {
      msg: `Password ${roomPassword} for ${roomName} was incorrect.`, //omega Adjust this msg to be less revealing.
    });
    return;
  }

  if (
    room.players.find((roomPlayer) => roomPlayer.socketId === player.socketId)
  ) {
    console.log(
      `€ Entry denied. ${socket.id.slice(0, 4)} already in ${room.roomName}.`
    );
    socket.emit("Entry denied", {
      msg: `I believe you are already in room ${room.roomName}. Perhaps in another tab?`,
    });
    return;
  }

  console.log(
    `Socket ${socket.id.slice(0, 4)} has entered room ${room.roomName}.`
  );
  room.players.push(player);
  socket.join(room.roomName);
  console.log("€ Entry granted");
  socket.emit("Entry granted", {
    room: room.trim(),
  });
  socket.to(room.roomName).emit("Player entered your room", {
    player: player.trim(),
    room: room.trim(),
  });
}

function makePlayerLeaveRoom(socket, player, data) {
  console.log("Leave room");

  if (!player) {
    console.log(`makePlayerLeaveRoom sees that player is undefined.`);
    return;
  }

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
    player,
    room: room.trim(),
  });
  socket.emit("You're booted", {
    msg: `You've been booted from room ${room.roomName}.`,
    roomName: room.roomName,
  });
  socket.leave(room.roomName);

  if (!room.players.length) {
    console.log(`Deleting room ${room.roomName}.`);

    let indexOfRoomToDelete = rooms.indexOf(
      (roo) => roo.roomName === room.roomName
    );
    rooms.splice(indexOfRoomToDelete, 1); //gamma There ought to be a more reliable way to do this.
  }
}
