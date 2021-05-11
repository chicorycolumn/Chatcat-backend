const dataUtils = require("./dataUtils.js");

exports.isSocketActive = (io, socketId) => {
  const activeSocketIds = [...io.of("/").adapter.sids.entries()].map(
    (subArr) => subArr[0]
  );
  return activeSocketIds.includes(socketId);
};

exports.updatePlayersWithRoomData = (io, rooms, roomName, room, chatMsg) => {
  if (!roomName) {
    console.log("L51");
    return;
  }

  if (!room) {
    room = rooms.find((roo) => roo.roomName === roomName);
  }

  io.in(roomName).emit("Room data", { room: room.trim() });
  if (chatMsg) {
    io.in(roomName).emit("Chat message", { chatMsg });
  }
};

exports.makePlayerEnterRoom = (
  socket,
  rooms,
  player,
  sentData,
  room,
  isRoomboss
) => {
  let { roomName, roomPassword } = sentData;

  console.log(
    `<${socket.id.slice(0, 4)}> ${player.playerName}${
      player.truePlayerName
    } wants to enter room "${roomName}".`
  );

  if (!room) {
    room = rooms.find((room) => room.roomName === roomName);
  }

  if (!room) {
    console.log("€ Entry denied. Room not found.");
    socket.emit("Entry denied", {
      msg: { text: `Room ${roomName} not found.`, emotion: "sad" },
    });
    return;
  }

  if (room.isPasswordProtected && room.roomPassword !== roomPassword) {
    if (!room.roomPassword) {
      console.log(
        "H44 This room is password protected yet there's no password?"
      );
    }
    console.log(
      `€ Entry denied. Password ${roomPassword} for ${roomName} was incorrect, the password was actually ${room.roomPassword}.`
    );
    socket.emit("Entry denied", {
      msg: {
        text: `Password ${roomPassword} for ${roomName} was incorrect.`,
        emotion: "sad",
      },
    });
    return;
  }

  if (
    room.players.find((roomPlayer) => roomPlayer.socketId === player.socketId)
  ) {
    console.log(
      `€ Entry denied. ${player.playerName}${player.truePlayerName} already in ${room.roomName}.`
    );
    socket.emit("Entry denied", {
      msg: {
        text: `I believe you are already in room ${room.roomName}. Perhaps in another tab?`,
        emotion: "sad",
      },
    });
    return;
  }

  if (player.mostRecentRoom !== room.roomName) {
    console.log(
      `Wiping player stats for ${player.playerName}${player.truePlayerName} as they are entering a new room, ie not re-entering.`
    );
    exports.resetPlayerGameStats(player, true);
  }

  dataUtils.suffixPlayerNameIfNecessary(room, player);
  player.isRoomboss = isRoomboss;

  room.players.push(player);
  socket.join(room.roomName);

  player.mostRecentRoom = room.roomName;

  console.log(
    `Removing <${socket.id.slice(0, 4)}> from the door of ${
      room.roomName
    } if they are.`
  );
  console.log("room.playersAtTheDoor was", room.playersAtTheDoor);
  room.playersAtTheDoor = room.playersAtTheDoor.filter(
    (socketId) => socketId !== socket.id
  );
  console.log("room.playersAtTheDoor now", room.playersAtTheDoor);

  socket.emit("Entry granted", {
    room: room.trim(),
    player,
    roomPassword: isRoomboss ? roomPassword : null,
  });

  socket.to(room.roomName).emit("Player entered your room", {
    player: player.trim(),
    room: room.trim(),
  });

  console.log(
    `<${socket.id.slice(0, 4)}> ${player.playerName}${
      player.truePlayerName
    } entered room ${room.roomName}.`
  );
};

exports.resetPlayerGameStats = (player, resetIsRoombossProperty) => {
  Object.keys(player.gameStatProperties).forEach((gameStatKey) => {
    if (gameStatKey === "isRoomboss" && !resetIsRoombossProperty) {
      return;
    }
    let gameStatDefaultValue = player.gameStatProperties[gameStatKey];
    player[gameStatKey] = gameStatDefaultValue;
  });
};

exports.makePlayerLeaveRoom = (
  io,
  socket,
  rooms,
  players,
  leavingPlayer,
  roomName
) => {
  console.log("\n");
  console.log("* * *");
  console.log("\n");
  console.log(
    `<${socket.id.slice(0, 4)}> Leave room for ${leavingPlayer.playerName}${
      leavingPlayer.truePlayerName
    }`
  );
  let room;

  if (true) {
    if (!leavingPlayer) {
      console.log(`makePlayerLeaveRoom sees that leavingPlayer is undefined.`);
      return;
    }

    room = rooms.find((roo) => roo.roomName === roomName);

    if (!room) {
      room = rooms.find((roo) =>
        roo.players.find(
          (rooPlayer) => rooPlayer.socketId === leavingPlayer.socketId
        )
      );
    }

    if (!room) {
      console.log(
        `<${socket.id.slice(
          0,
          4
        )}> to leave room ${roomName} but no such room exists.`
      );
      return;
    }

    if (
      !room.players.find(
        (roomPlayer) => roomPlayer.socketId === leavingPlayer.socketId
      )
    ) {
      console.log(
        `<${socket.id.slice(0, 4)}> not even in ${room ? room.roomName : room}`
      );
      return;
    }
  }

  console.log(
    `<${socket.id.slice(0, 4)}> ${leavingPlayer.playerName}${
      leavingPlayer.truePlayerName
    } is leaving room ${room.roomName}`
  );

  if (room.players.length === 1) {
    console.log("\n");
    console.log(
      "Rooms array was",
      rooms.map((roo) => roo.roomName)
    );

    console.log("Delete this Room as its only player has left.");
    dataUtils.deleteFromArray(rooms, { roomName: room.roomName });

    console.log(
      "Rooms array now",
      rooms.map((roo) => roo.roomName)
    );

    console.log(
      "I deleted the room, so now I'm looking at the players whose most recent room was that one."
    );

    players.forEach((playe) => {
      if (playe.mostRecentRoom === room.roomName) {
        if (!exports.isSocketActive(io, playe.socketId)) {
          console.log(
            `Deleting player ${playe.playerName}${playe.truePlayerName} as they're inactive.`
          );
          dataUtils.deleteFromArray(players, {
            truePlayerName: playe.truePlayerName,
          });
        } else {
          console.log(
            `Wiping player stats for ${playe.playerName}${playe.truePlayerName} as they're still active.`
          );
          console.log("This player was:", playe);
          exports.resetPlayerGameStats(playe, true);
          console.log("This player now:", playe);
        }
      }
    });
    console.log("\n");
    return;
  }

  room.players = room.players.filter(
    (roomPlayer) => roomPlayer.socketId !== leavingPlayer.socketId
  );

  if (leavingPlayer.isRoomboss) {
    let newRoomboss =
      room.players[Math.floor(Math.random() * room.players.length)];

    newRoomboss.isRoomboss = true;

    socket.to(newRoomboss.socketId).emit("Player loaded", {
      player: newRoomboss,
      msg: { text: "You are now the roomboss.", emotion: "happy" },
    });
  }

  if (socket.id === leavingPlayer.socketId) {
    socket.leave(room.roomName);
    socket.to(room.roomName).emit("Player left your room", {
      player: leavingPlayer,
      room: room.trim(),
    });
  } else {
    console.log(
      `€ You're booted ${leavingPlayer.playerName}${leavingPlayer.truePlayerName}`
    );
    socket.to(leavingPlayer.socketId).emit("You're booted", {
      msg: {
        text: `You've been booted from ${room.roomName}.`,
        emotion: "sad",
      },
      roomName: room.roomName,
    });
    io.in(room.roomName)
      .except(leavingPlayer.socketId)
      .emit("Player left your room", {
        player: leavingPlayer,
        room: room.trim(),
        isBoot: true,
      });
  }

  console.log("\n");
  console.log("* *");
  console.log("\n");
};
