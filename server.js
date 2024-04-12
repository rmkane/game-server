// Import necessary modules
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";

// Initialize express application
const app = express();
const PORT = 3000;

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Create an HTTP server from the express application
const server = createServer(app);

// Initialize WebSocket server with no server handling
const wss = new WebSocketServer({ noServer: true });

// Object to hold all active game sessions
const games = {};

// Route to create a new game and redirect to the game page
app.get("/new-game", (req, res) => {
  const gameId = uuidv4();
  games[gameId] = { players: [], board: Array(9).fill(null), turn: 0 };
  res.redirect(`/game/${gameId}`);
});

// Route to join a specific game if it exists
app.get("/join-game/:gameId", (req, res) => {
  const gameId = req.params.gameId;
  if (games[gameId] && games[gameId].players.length < 2) {
    res.redirect(`/game/${gameId}`);
  } else {
    res.status(404).send("Game not found or is full");
  }
});

// Route to serve the game page
app.get("/game/:gameId", (req, res) => {
  if (games[req.params.gameId]) {
    res.sendFile("game.html", { root: "public" });
  } else {
    res.status(404).send("Game not found");
  }
});

// Handle HTTP upgrades to WebSocket connections
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`)
    .pathname;
  const gameId = pathname.split("/")[2];

  if (games[gameId]) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

function broadcastGameState(gameId, message) {
  games[gameId].players.forEach((client) => {
    client.send(JSON.stringify(message));
  });
}

// Manage WebSocket connections for game logic
wss.on("connection", (ws, req) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const gameId = pathname.split("/")[2];
  const game = games[gameId];

  if (game && game.players.length < 2) {
    const playerIndex = game.players.push(ws) - 1;
    ws.playerIndex = playerIndex; // Assign player index to WebSocket object

    ws.send(
      JSON.stringify({ type: "role", player: playerIndex === 0 ? "X" : "O" })
    );

    // Notify players when two are connected and game starts
    if (game.players.length === 2) {
      game.state = "active";
      game.turn = 0; // Ensures that X starts
      game.players.forEach((client, index) => {
        client.send(
          JSON.stringify({
            type: "start",
            message: "Game has started",
            turn: game.turn,
            yourTurn: index === game.turn,
          })
        );
      });
    }
  } else {
    ws.close(); // Game is full or does not exist
  }

  ws.on("message", function incoming(message) {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    const gameId = pathname.split("/")[2];
    const game = games[gameId];

    const data = JSON.parse(message);
    const playerIndex = ws.playerIndex; // Retrieve player index from WebSocket object

    // Handle game actions only if the game is active
    if (game.state === "active") {
      switch (data.type) {
        case "move":
          if (game.turn === playerIndex && game.board[data.index] === null) {
            game.board[data.index] = playerIndex === 0 ? "X" : "O";
            const win = checkWin(playerIndex, game.board);
            const tie = !win && checkTie(game.board);

            broadcastGameState(gameId, {
              type: "move",
              index: data.index,
              player: game.turn === 0 ? "X" : "O",
            });

            if (win) {
              broadcastGameState(gameId, { type: "win", player: game.turn });
              game.board.fill(null);
              game.turn = 0; // Optionally switch who starts next
            } else if (tie) {
              broadcastGameState(gameId, { type: "tie" });
              game.board.fill(null);
              game.turn = 0;
            } else {
              game.turn = (game.turn + 1) % 2;
              broadcastGameState(gameId, { type: "turn", turn: game.turn });
            }
          }
          break;
        case "rematch":
          game.players.forEach((client) => {
            if (client !== ws) {
              client.send(JSON.stringify({ type: "rematchOffer" }));
            }
          });
          break;
        case "rematchAccepted":
          game.players.forEach((client) => {
            client.send(JSON.stringify({ type: "reset" }));
          });
          game.board.fill(null);
          game.turn = 0;
          break;
      }
    }
  });

  ws.on("close", () => {
    game.players = game.players.filter((player) => player !== ws);
    if (game.players.length < 2) {
      game.state = "waiting";
    }
  });
});

function checkWin(player, board) {
  const symbol = player === 0 ? "X" : "O";
  const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // Rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // Columns
    [0, 4, 8],
    [2, 4, 6], // Diagonals
  ];

  const didWin = winningCombinations.some((combination) => {
    return combination.every((index) => board[index] === symbol);
  });

  return didWin;
}

function checkTie(board) {
  return board.every((cell) => cell !== null);
}

// Start the server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
