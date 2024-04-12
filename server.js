const express = require("express");
const { WebSocketServer } = require("ws");
const app = express();
const PORT = 3000;

// Serve static files from the public directory
app.use(express.static("public"));

// Create the HTTP server and listen on the specified port
const server = app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);

// Initialize the WebSocket server on top of the HTTP server
const wss = new WebSocketServer({ server });

let players = []; // List to store connected players
let turn = 0; // Tracks whose turn it is, 0 for X and 1 for O
let board = Array(9).fill(null); // Array to represent the 3x3 Tic-Tac-Toe board

// Function to check if the current board state includes a winning combination
function checkWin(player) {
  const symbol = player === 0 ? "X" : "O";
  const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // Horizontal wins
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // Vertical wins
    [0, 4, 8],
    [2, 4, 6], // Diagonal wins
  ];
  return winningCombinations.some((combination) => {
    return combination.every((index) => board[index] === symbol);
  });
}

// Function to check if all board cells are filled, indicating a tie
function checkTie() {
  return board.every((square) => square !== null);
}

// Event listener for new WebSocket connections
wss.on("connection", function connection(ws) {
  if (players.length < 2) {
    const playerIndex = players.length;
    ws.playerIndex = playerIndex;
    players.push(ws);
    ws.send(
      JSON.stringify({ type: "role", player: playerIndex === 0 ? "X" : "O" })
    );
    if (players.length === 2) {
      players.forEach((player, index) => {
        player.send(
          JSON.stringify({
            type: "start",
            message: `Game started: You are ${index === 0 ? "X" : "O"}`,
            turn: index === 0, // X starts the game, so index 0 is true, index 1 is false
          })
        );
      });
    }
  } else {
    ws.close(); // Close any connections beyond the first two
  }

  ws.on("message", function incoming(message) {
    const data = JSON.parse(message);

    switch (data.type) {
      case "move":
        if (ws.playerIndex === turn && board[data.index] === null) {
          board[data.index] = turn === 0 ? "X" : "O";
          const win = checkWin(turn);
          const tie = checkTie();

          players.forEach((client) => {
            client.send(
              JSON.stringify({ type: "move", index: data.index, player: turn })
            );
          });

          if (win) {
            players.forEach((client) => {
              client.send(JSON.stringify({ type: "win", player: turn }));
            });
            board.fill(null); // Reset the board
            turn = 0; // X starts the next game
          } else if (tie) {
            players.forEach((client) => {
              client.send(JSON.stringify({ type: "tie" }));
            });
            board.fill(null); // Reset the board
            turn = 0; // X starts the next game
          } else {
            turn = (turn + 1) % 2; // Toggle the turn to the next player
          }

          // Move turn notification outside the conditions to ensure it's always sent
          players.forEach((client) => {
            client.send(JSON.stringify({ type: "turn", turn: turn }));
          });
        }
        break;
      case "rematch":
        players.forEach((client) => {
          if (client !== ws) {
            client.send(JSON.stringify({ type: "rematchOffer" }));
          }
        });
        break;
      case "rematchAccepted":
        players.forEach((client) => {
          client.send(JSON.stringify({ type: "reset" }));
        });
        board.fill(null); // Reset the board
        turn = 0; // X starts the new game
        break;
    }
  });

  ws.on("close", () => {
    players = players.filter((player) => player !== ws);
    if (players.length < 2) {
      board.fill(null); // Reset the board if a player disconnects
      turn = 0; // Reset turn if necessary
    }
  });
});
