class Room {
  constructor(roomName, roomPassword, players) {
    this.roomName = roomName;
    this.roomPassword = "";
    this.isPasswordProtected = false;
    this.players = players || [];
  }

  trim() {
    return {
      roomName: this.roomName,
      isPasswordProtected: this.isPasswordProtected,
      players: this.players.map((player) => player.trim()),
    };
  }
}

class Player {
  constructor(truePlayerName, socketId, playerName, stars) {
    this.truePlayerName = truePlayerName;
    this.socketId = socketId;
    this.playerName = playerName;
    this.stars = stars || 0;
    this.isRoomboss = false;
    this.mostRecentRoom = null;
    this.gameStatProperties = { stars: 0, isRoomboss: false };
  }

  trim() {
    return {
      playerName: this.playerName,
      stars: this.stars,
      isRoomboss: this.isRoomboss,
    };
  }
}

module.exports = { Room, Player };
