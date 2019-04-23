// @ts-check
const express = require("express");
const app = express();
const socketIO = require("socket.io");
const PORT = process.env.PORT || 3000;
const uuid = require("uuid/v4");

const server = app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});

const io = socketIO(server, {
  pingInterval: 15000,
  pingTimeout: 60000
});

//_global array of ids of all connected users
const __users = [];

//_global assoc array of connections (pipes) between users. Indexed by unique id
const __connections = [];

io.on("connection", socket => {
  console.log(`new connection: ${socket.id}`);
  __users.push(socket.id);

  //check if there are other users connected or is the only one
  if (__users.length > 1) {
    const otherUsers = __users.filter(user => user !== socket.id);
    //loop through other users, creating new pipes between new user and every other user
    otherUsers.forEach(otherUser => {
      const pipeId = uuid();
      __connections[pipeId] = createNewPipe(socket.id, otherUser);
      //send message to specific user to create a pipe and listen for incoming connection
      io.to(otherUser).emit("createNewPipe", {
        pipeId,
        initiator: false
      });
      //tell new connected user to create a pipe and start connecting to others
      socket.emit("createNewPipe", { pipeId, initiator: true });
    });
  } else {
    //if user is the only one in the room, telling him just to wait
    socket.emit("created", null);
  }
  //-----------------------logging area-----------------------
  console.dir(__connections);
  console.dir("---------------------------------------------");
  //----------------------------------------------------------
  socket.on("signal", ({ signalingData, pipeId }) => {
    //picks id of the other user in the pipe
    if (typeof __connections[pipeId] == "undefined") return;

    const [otherUser] = __connections[pipeId].usersIds.filter(
      id => id !== socket.id
    );
    //pass signaling data to user on the other end of the pipe
    if (typeof otherUser === "string") {
      io.to(otherUser).emit("signal", { signalingData, pipeId });
    }
  });

  socket.on("disconnect", reason => {
    console.log(`user: ${socket.id} - disconnected. Reason: ${reason}`);

    __users.splice(__users.indexOf(socket.id), 1);
    //delete pipes that user was part of
    for (const conn in __connections) {
      if (__connections[conn].usersIds.includes(socket.id))
        delete __connections[conn];
    }
    console.log(__connections);
  });
});

function createNewPipe(socketId, secondPeer) {
  return {
    usersIds: [socketId, secondPeer]
  };
}
