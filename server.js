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

  socket.on("Dev query rooms", function (data) {
    console.log("Dev asked to query rooms.");
    socket.emit("Dev queried rooms", {
      roomList: rooms,
    });
  });

  socket.on("Prayer", function (data) {
    console.log(data);
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
      playerList: room.players,
    });

    if (true) {
      setTimeout(() => {
        console.log("entry granted again");
        socket.emit("Entry granted", {
          roomName: room.roomName,
          playerList: room.players,
        });
      }, 1000);
      setTimeout(() => {
        console.log("entry granted again");
        socket.emit("Entry granted", {
          roomName: room.roomName,
          playerList: room.players,
        });
      }, 2000);
      setTimeout(() => {
        console.log("entry granted again");
        socket.emit("Entry granted", {
          roomName: room.roomName,
          playerList: room.players,
        });
      }, 3000);
    }
  });

  socket.on("Leave room", function (data) {
    let room = rooms.find((room) => room.roomName === data.roomName);

    if (!room) {
      console.log(
        `Socket ${socket.id.slice(0, 5)} asked to leave room ${
          data.roomName
        } but no such room exists.`
      );
      return;
    }

    console.log(
      `Socket ${socket.id.slice(0, 5)} is leaving room ${data.roomName}`
    );
    room.players = room.players.filter(
      (roomPlayer) => roomPlayer.socketId !== player.socketId
    );
    socket.leave(room.roomName);
  });

  socket.on("login", function (loginData) {
    const newPlayer = {};
    newPlayer.id = socket.id;
    newPlayer.username = loginData.username;
    players.push(newPlayer);

    socket.emit("connectionReply", { rooms, myUsername: newPlayer.username });
  });

  socket.on("joinRoom", (data) => {
    makePlayerJoinRoom(data, socket);
  });

  socket.on("playerChangesLetter", function (data) {
    const { array, roomID } = data;
    socket.to(roomID).emit("opponentUpdates", {
      array: array,
    });
  });

  socket.on("I submitted", function (data) {
    socket.emit("You submitted");
    socket.to(data.roomID).emit("opponent submitted", data);
  });

  socket.on("worm word submitted", function (data) {
    const wormWord = data.submittedWord;
    if (
      wormWord.length < 3 &&
      !validOneOrTwoLetterWords.includes(wormWord.toLowerCase())
    ) {
      io.to(socket.id).emit("word checked", {
        word: wormWord,
        isValid: false,
        points: 0,
        pointsArray: [0],
      });
      socket.to(data.roomID).emit("opponent score", {
        word: wormWord,
        isValid: false,
        points: 0,
        pointsArray: [0],
      });
    } else {
      validateWord(wormWord)
        .then((res) => {
          let scrabblePointsArray = wormWord
            .split("")
            .map((letter) => scrabblePoints[letter]);
          let scrabblePointsTotal = scrabblePointsArray.reduce((a, b) => a + b);

          io.to(socket.id).emit("word checked", {
            word: wormWord,
            isValid: true,
            points: scrabblePointsTotal,
            pointsArray: scrabblePointsArray,
          });
          socket.to(data.roomID).emit("opponent score", {
            word: wormWord,
            isValid: true,
            points: scrabblePointsTotal,
            pointsArray: scrabblePointsArray,
          });
        })
        .catch((error) => {
          if (error.response.status === 404) {
            io.to(socket.id).emit("word checked", {
              word: wormWord,
              isValid: false,
              points: 0,
            });
            socket.to(data.roomID).emit("opponent score", {
              word: wormWord,
              isValid: false,
              points: 0,
            });
          } else {
            io.to(socket.id).emit("api error", {
              status: error.response.status,
              message: error.response.statusText,
            });
          }
        });
    }
  });

  socket.on("update rounds", function (data) {
    const { roundsWon, roomID } = data;
    io.in(roomID).emit("set new rounds", roundsWon);
  });

  socket.on("make new game request", function (data) {
    const { name, player, roomID } = data;
    socket.to(roomID).emit("new game request", { name, player });
  });

  socket.on("new game", function (roomID) {
    io.in(roomID).emit("start new game");
  });

  socket.on("both players ready", (data) => {
    io.in(data.roomID).emit("start the game");
  });

  socket.on("disconnect", () => {
    console.log(
      `Socket ${socket.id.slice(
        0,
        5
      )} disconnected at ${new Date().toUTCString().slice(17, -4)}.`
    );
  });

  socket.on("create room", (data) => {
    let newRoomID = findFirstGapOrReturnNext(rooms);
    let newRoom = generateRoom(newRoomID, data.roomName);
    rooms.push(newRoom);
    makePlayerJoinRoom(
      { roomID: newRoom.roomID, playerFacesToServer: data.playerFacesToServer },
      socket
    );
  });

  socket.on("quitRoom", () => {
    makePlayerLeaveRoom(socket);
  });

  socket.on("clientSentChat", function (data) {
    data.chatTimestamp = Date.now();
    data.sendingPlayerID = socket.id;
    socket.emit("serverSentChat", data);
    socket.in(data.roomID).emit("serverSentChat", data);
  });
});

function makePlayerLeaveRoom(socket) {
  let roomToLeaveArray = rooms.filter(
    (room) => room.p1.id === socket.id || room.p2.id === socket.id
  );

  if (roomToLeaveArray.length !== 1) {
  } else {
    let roomToLeave = roomToLeaveArray[0];

    let playerLabel = roomToLeave.p1.id === socket.id ? "p1" : "p2";

    let leavingPlayerUsername = roomToLeave[playerLabel].username;

    roomToLeave[playerLabel] = { username: null, id: null };

    socket.broadcast.to(roomToLeave.roomID).emit("a player left your game", {
      currentRoom: roomToLeave,
      leavingPlayerID: socket.id,
      leavingPlayerUsername,
    });

    if (roomToLeave.roomID != 1 && !roomToLeave.p1.id && !roomToLeave.p2.id) {
      rooms = _.filter(rooms, function (room) {
        return room.roomID != roomToLeave.roomID;
      });
    }

    socket.broadcast.emit("lobbyUpdate", {
      rooms,
    });

    socket.leave(roomToLeave.roomID);
  }
}

function makePlayerJoinRoom(data, socket) {
  if (
    !rooms.some((room) => room.p1.id === socket.id || room.p2.id === socket.id)
  ) {
    let roomID = Number(data.roomID);

    let roomSheWantsToJoin = _.find(rooms, { roomID });
    if (
      shallILimitRoomParticipants &&
      (!roomSheWantsToJoin ||
        (roomSheWantsToJoin.p1.id && roomSheWantsToJoin.p2.id))
    ) {
      socket.emit("connectionRefused");
      return;
    }

    if (data.developmentCheat) {
      const newPlayer = {};
      newPlayer.id = socket.id;
      newPlayer.username = `DEV-TEST-${Math.floor(
        Math.random().toFixed(4) * 10000
      )}`;
      players.push(newPlayer);
    }

    let player = _.find(players, { id: socket.id });

    player.playerFaces = data.playerFacesToServer;

    let whichPlayerIsShe;

    if (roomSheWantsToJoin.p1.id === null) {
      roomSheWantsToJoin.p1 = player;
      whichPlayerIsShe = "p1";
    } else {
      roomSheWantsToJoin.p2 = player;
      whichPlayerIsShe = "p2";
    }

    socket.join(roomID);

    socket.broadcast.to(roomID).emit("a player entered your game", {
      currentRoom: roomSheWantsToJoin,
      enteringPlayerID: socket.id,
      enteringPlayerUsername: player.username,
      enteringPlayer: player,
    });

    socket.broadcast.emit("lobbyUpdate", {
      rooms,
    });

    io.to(socket.id).emit("youJoinedARoom", {
      youCanEnter: true,
      playersDetails: { p1: roomSheWantsToJoin.p1, p2: roomSheWantsToJoin.p2 },
      room: roomSheWantsToJoin,
      whichPlayerIsShe,
    });
  }
}

function generateRoom(roomID, roomName) {
  let room = {
    roomID,
    roomName:
      roomName || `${adjObj[Math.floor(Math.random() * 10)]} room ${roomID}`,
    p1: { username: null, id: null },
    p2: { username: null, id: null },
  };
  return room;
}
