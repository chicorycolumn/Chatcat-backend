class Room {
  constructor(roomName, roomPassword, players) {
    this.roomName = roomName;
    this.roomPassword = roomPassword;
    this.players = players || [];
  }

  trim() {
    return {
      roomName: this.roomName,
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
