class Room {
  constructor(roomName, players, questions) {
    this.roomName = roomName;
    this.players = players || [];
    this.questions = questions || ["What's your favourite colour?"];
  }

  trim() {
    return {
      roomName: this.roomName,
      players: this.players.map((player) => player.trim()),
      questions: this.questions,
    };
  }
}

class Player {
  constructor(truePlayerName, socketId, playerName, stars) {
    this.truePlayerName = truePlayerName;
    this.socketId = socketId;
    this.playerName = playerName;
    this.stars = stars || 0;
  }

  trim() {
    return {
      socketId: this.socketId,
      playerName: this.playerName,
      stars: this.stars,
    };
  }
}

module.exports = { Room, Player };
