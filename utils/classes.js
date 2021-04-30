class Room {
  constructor(roomName, roomPassword, players, questions) {
    this.roomName = roomName;
    this.roomPassword = roomPassword;
    this.players = players || [];
    this.questions = questions || ["What's your favourite colour?"];
  }

  trim() {
    return {
      roomName: this.roomName,
      players: this.players.map((player) => player.trim()),
      questions: this.questions,
      roomPassword: this.roomPassword, //omega Delete this in Prod
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
  }

  trim() {
    return {
      socketId: this.socketId,
      playerName: this.playerName,
      stars: this.stars,
      isRoomboss: this.isRoomboss,
    };
  }
}

module.exports = { Room, Player };
