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
        player.playerName.slice(0, 16 - suffix.length) + suffix
    )
  ) {
    suffix = incrementNumToString(suffix);
  }

  player.playerName = player.playerName.slice(0, 16 - suffix.length) + suffix;

  function incrementNumToString(str) {
    if (!str.length) {
      return "2";
    }
    let newNum = parseInt(str) + 1;
    return newNum.toString();
  }
};

exports.deleteFromArray = (arr, identifyingData) => {
  let indexOfItemToDelete = arr.indexOf(
    arr.find((item) =>
      Object.keys(identifyingData).every((key) => {
        return item[key] === identifyingData[key];
      })
    )
  );
  if (indexOfItemToDelete === -1) {
    console.log({ indexOfItemToDelete });
    throw "H33";
  }
  arr.splice(indexOfItemToDelete, 1); //gamma There ought to be a more reliable way to do this.
};
