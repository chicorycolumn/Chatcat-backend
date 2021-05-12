const app = require("express")();
const cors = require("cors");
const port = process.env.PORT || 4002;
const index = require("./routes/index");
const { Player, Room } = require("./utils/classes.js");
const dataUtils = require("./utils/dataUtils.js");
const socketUtils = require("./utils/socketUtils.js");

app.use(cors());
app.use(index);

const options = {
  cors: {
    origins: ["http://127.0.0.1:3000", "https://chattercat.netlify.app/"],
    methods: ["GET", "POST"],
  },
};
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, options);

httpServer.listen(port, () => console.log(`Listening on port ${port}`));

const rooms = [];
const players = [];

io.on("connection", (socket) => {
  console.log(
    `ø connection <${socket.id.slice(0, 4)}> at ${new Date()
      .toUTCString()
      .slice(17, -4)}.`
  );

  socket.on("Dev destroy all", function () {
    console.log(`ø DESTROY <${socket.id.slice(0, 4)}>`);

    [rooms, players].forEach((arr) => {
      while (arr.length) {
        arr.pop();
      }
    });
  });

  socket.on("Dev query", function (data) {
    console.log(`ø Dev query <${socket.id.slice(0, 4)}>`);
    console.log("players", players);
    socket.emit("Dev queried", {
      rooms: rooms,
      players: players,
    });
  });

  socket.on("Load player", function (data) {
    console.log(`ø Load player <${socket.id.slice(0, 4)}>`, data);

    if (!data.playerName) {
      console.log("Load player sees that !data.playerName");
      data.playerName = `Player${Math.floor(Math.random() * 100)}`;
    }

    console.log("And just so you know, current players arr is:", players);

    let putativePlayerName = dataUtils.alphanumerise(data.playerName);

    if (!putativePlayerName) {
      console.log("G74");
      return;
    }

    let player = data.truePlayerName
      ? players.find((playe) => playe.truePlayerName === data.truePlayerName)
      : null;

    if (player) {
      console.log(
        `>Using extant player ${player.playerName}${player.truePlayerName}`
      );
      io.in(player.socketId).disconnectSockets();
      player.socketId = socket.id;
    } else {
      let putativeTruePlayerName = `_${dataUtils.randomString(16)}`;

      console.log(
        `>Creating new player ${putativePlayerName}${putativeTruePlayerName}`
      );

      player = new Player(
        putativeTruePlayerName,
        socket.id,
        putativePlayerName
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
    console.log(`ø Update player data <${socket.id.slice(0, 4)}>`, data);

    if (!data.player) {
      console.log("L31 You want to update player with nothing?");
      return;
    }

    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`L32 no player found.`);
      return;
    }

    console.log("Updating player data", data.player);
    Object.keys(data.player).forEach((k) => {
      let v = data.player[k];
      player[k] = v;
    });

    console.log("players arr after I updated player", players);
    socket.emit("Player loaded", { player });
  });

  socket.on("disconnecting", (data) => {});

  socket.on("Query room password protection", function (data) {
    let room = rooms.find((roo) => roo.roomName === data.roomName);

    if (room && room.players.find((playe) => playe.socketId === socket.id)) {
      console.log("Client sent QRPP while bypassing Door, so ignore.");
      //Because Door is loaded-unloaded briefly when player goes straight from Lobby to Room.
      return;
    }

    console.log("Ø Query room password protection");

    if (!room) {
      console.log(`Y28 No such room ${data.roomName}`);
      socket.emit("Room not created or found", {
        msg: { text: `Room ${data.roomName} does not exist.`, emotion: "sad" },
      });
      return;
    }

    if (data.amLeaving) {
      console.log(
        `Removed <${socket.id.slice(0, 4)}> from the door of ${room.roomName}.`
      );
      room.playersAtTheDoor = room.playersAtTheDoor.filter(
        (socketId) => socketId !== socket.id
      );
      return;
    }

    if (!room.playersAtTheDoor.includes(socket.id)) {
      console.log(
        `Added <${socket.id.slice(0, 4)}> to the door of ${room.roomName}.`
      );
      room.playersAtTheDoor.push(socket.id);
    }

    socket.emit("Queried room password protection", {
      roomName: room.roomName,
      isPasswordProtected: room.isPasswordProtected,
    });
  });

  socket.on("disconnect", (data) => {
    console.log(
      `ø disconnect <${socket.id.slice(0, 4)}> disconnected at ${new Date()
        .toUTCString()
        .slice(17, -4)}.`
    );
    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`B11 no player found.`);
      return;
    }

    socketUtils.makePlayerLeaveRoom(
      io,
      socket,
      rooms,
      players,
      player,
      data.roomName
    );

    //If this player's most recent room has been deleted, then delete this player.
    let mostRecentRoom = rooms.find(
      (roo) => roo.roomName === player.mostRecentRoom
    );
    if (!mostRecentRoom) {
      dataUtils.deleteFromArray(players, { socketId: player.socketId });
    }
  });

  socket.on("Chat message", function (data) {
    console.log(`ø Chat message <${socket.id.slice(0, 4)}>`);

    let roomName = roomNameBySocket(socket);

    if (!roomName) {
      console.log("T27 No room found that contains this socket.");
      return;
    }

    let room = rooms.find((roo) => roo.roomName === roomName);

    if (!room) {
      console.log(`T28 No such room called ${roomName}.`);
      return;
    }

    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`T29 no player found.`);
      return;
    }
    data.sender = player.trim();

    io.in(room.roomName).emit("Chat message", data);
  });

  socket.on("Create room", function (data) {
    let putativeRoomName = dataUtils.alphanumerise(data.roomName);

    console.log(
      `ø Create room. <${socket.id.slice(
        0,
        4
      )}> We'll create room "${putativeRoomName}".`
    );

    if (!putativeRoomName) {
      console.log("€ Room not created - bad putative name");
      socket.emit("Room not created or found", {
        msg: { text: `Please supply a room name.`, emotion: "sad" },
      });
      return;
    }

    if (
      dataUtils.bannedRoomNames.includes(putativeRoomName) ||
      rooms.find((room) => room.roomName === putativeRoomName)
    ) {
      console.log("€ Room not created - already exists");
      socket.emit("Room not created or found", {
        msg: {
          text: `Room ${putativeRoomName} already exists.`,
          emotion: "sad",
        },
      });
      return;
    }

    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`T30 no player found.`);
      socket.emit("You should refresh");
      return;
    }

    let room = new Room(putativeRoomName);
    rooms.push(room);

    socketUtils.makePlayerEnterRoom(socket, rooms, player, data, room, true);
  });

  socket.on("Request entry", function (data) {
    console.log(`ø Request entry <${socket.id.slice(0, 4)}>`, data);
    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`C11 no player found, € You should refresh`);
      socket.emit("You should refresh");
      return;
    }

    socketUtils.makePlayerEnterRoom(socket, rooms, player, data);
  });

  socket.on("Request room data", function (data) {
    console.log(`ø Request room data <${socket.id.slice(0, 4)}>`, data);
    let room = rooms.find((roo) => roo.roomName === data.roomName);

    if (!room) {
      console.log("M45 No room found.");
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
    console.log(`ø Leave room <${socket.id.slice(0, 4)}>`, data);
    let player = players.find((playe) => playe.socketId === socket.id);
    if (!player) {
      console.log(`W11 No player found.`);
      return;
    }
    socketUtils.makePlayerLeaveRoom(
      io,
      socket,
      rooms,
      players,
      player,
      data.roomName
    );
  });

  socket.on("Give stars", function (data) {
    console.log(`ø Give stars <${socket.id.slice(0, 4)}>`, data);
    let roomName = roomNameBySocket(socket);

    if (!roomName) {
      console.log("U30 None such.");
      return;
    }

    let room = rooms.find((roo) => roo.roomName === roomName);

    if (!room) {
      console.log("U31 None such.");
      return;
    }

    let playerToStar = room.players.find(
      (roomPlayer) => roomPlayer.playerName === data.playerNameToStar
    );

    if (playerToStar) {
      playerToStar.stars += data.starIncrement;

      socketUtils.updatePlayersWithRoomData(io, rooms, roomName);
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
        `K22 How can this player <${socket.id.slice(
          0,
          4
        )}> be asking to change ${
          room.roomName
        }'s password, when they don't appear to be in the room?`
      );
      return;
    }

    if (data.flipPasswordProtection) {
      if (room.isPasswordProtected) {
        room.isPasswordProtected = false;
        room.roomPassword = "";
      } else {
        room.isPasswordProtected = true;
        room.roomPassword = dataUtils.fourLetterWord();
      }
      io.in(data.roomName).emit("Room data", { room: room.trim() });
    } else {
      let currentRoomPassword = room.roomPassword;
      let newRoomPassword = dataUtils.fourLetterWord(currentRoomPassword);
      room.roomPassword = newRoomPassword;
    }
    io.in(data.roomName).emit("Room password updated", {
      roomPassword: room.roomPassword,
      roomName: room.roomName,
    });

    room.playersAtTheDoor.forEach((socketId) => {
      io.in(socketId).emit("Queried room password protection", {
        roomName: room.roomName,
        isPasswordProtected: room.isPasswordProtected,
      });
    });
  });

  socket.on("Boot player", function (data) {
    console.log(
      `ø Boot player <${socket.id.slice(0, 4)}> we'll boot ${data.playerName}`
    );
    let player = players.find((playe) => playe.playerName === data.playerName);
    socketUtils.makePlayerLeaveRoom(
      io,
      socket,
      rooms,
      players,
      player,
      data.roomName
    );
  });

  socket.on("I was booted", function (data) {
    console.log(`ø I was booted <${socket.id.slice(0, 4)}>`);
    socket.leave(data.roomName);
  });

  socket.on("Wipe game stats", function (data) {
    console.log(`ø Wipe game stats <${socket.id.slice(0, 4)}>`);

    let room = rooms.find((room) => room.roomName === data.roomName);

    if (!room) {
      console.log(`Cannot wipe. Room ${data.roomName} not found.`);
      return;
    }

    let player = room.players.find(
      (roomPlayer) => roomPlayer.socketId === socket.id
    );

    if (!player || !player.isRoomboss) {
      console.log(
        `Cannot wipe. Player either not in room ${data.roomName} or is not roomBoss.`
      );
      return;
    }

    room.players.forEach((playe) => {
      socketUtils.resetPlayerGameStats(playe);
    });

    socketUtils.updatePlayersWithRoomData(
      io,
      rooms,
      data.roomName,
      room,
      "The roomboss has wiped the game stats"
    );
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
