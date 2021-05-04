const _remove = require("lodash/remove");

exports.randomString = (length) => {
  let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let str = "";

  for (let i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)].toString();
  }

  return str;
};

exports.suffixPlayerNameIfNecessary = (room, player) => {
  let suffix = "";

  while (
    room.players.find(
      (roomPlayer) =>
        roomPlayer.playerName ===
        player.playerName.slice(0, 12 - suffix.length) + suffix
    )
  ) {
    suffix = incrementNumToString(suffix);
  }

  player.playerName = player.playerName.slice(0, 12 - suffix.length) + suffix;

  function incrementNumToString(str) {
    if (!str.length) {
      return "2";
    }
    let newNum = parseInt(str) + 1;
    return newNum.toString();
  }
};

exports.deleteFromArray = (arr, identifyingData) => {
  _remove(arr, function (item) {
    return Object.keys(identifyingData).every(
      (key) => item[key] === identifyingData[key]
    );
  });
};

exports.bannedRoomNames = ["null", "undefined", "contact", "help"];

exports.alphanumerise = (str) => {
  return str
    .split("")
    .filter((char) => /[a-z0-9_]/i.test(char))
    .join("");
};
