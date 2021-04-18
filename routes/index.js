const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res
    .send({ response: "This is the socketio4-spike-backend server." })
    .status(200);
});

module.exports = router;
