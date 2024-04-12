const ws = new WebSocket("ws://localhost:3000");
const board = document.getElementById("board");
const playerInfo = document.getElementById("playerInfo");
const gameStatus = document.getElementById("gameStatus");
const playAgainButton = document.getElementById("playAgainButton");
let myTurn = false;
let mySymbol = "";

function updateTurnMessage() {
  gameStatus.textContent = myTurn
    ? "Your turn"
    : "Waiting for the other player";
}

function resetBoard() {
  Array.from(board.children).forEach((cell) => (cell.textContent = ""));
  playAgainButton.style.display = "none"; // Hide play again button
  updateTurnMessage();
}

ws.onmessage = function (event) {
  const response = JSON.parse(event.data);
  switch (response.type) {
    case "role":
      mySymbol = response.player;
      playerInfo.textContent = `You are ${mySymbol}`;
      break;
    case "start":
      myTurn = response.turn;
      updateTurnMessage();
      break;
    case "move":
      board.children[response.index].textContent =
        response.player === 0 ? "X" : "O";
      myTurn = response.player !== (mySymbol === "X" ? 0 : 1);
      updateTurnMessage();
      break;
    case "win":
      gameStatus.textContent =
        response.player === (mySymbol === "X" ? 0 : 1)
          ? "Congratulations, you won!"
          : "Sorry, you lost.";
      showPlayAgainOption();
      break;
    case "tie":
      gameStatus.textContent = "The game is a tie!";
      showPlayAgainOption();
      break;
    case "turn":
      myTurn = response.turn === (mySymbol === "X" ? 0 : 1);
      updateTurnMessage();
      break;
    case "rematchOffer":
      if (confirm("Opponent wants to play again. Accept?")) {
        ws.send(JSON.stringify({ type: "rematchAccepted" }));
      }
      break;
    case "reset":
      resetBoard();
      break;
  }
};

function showPlayAgainOption() {
  playAgainButton.style.display = "block"; // Show play again button
}

playAgainButton.addEventListener("click", function () {
  ws.send(JSON.stringify({ type: "rematch" }));
  playAgainButton.style.display = "none"; // Hide button after sending the request
});

board.addEventListener("click", function (e) {
  if (e.target.tagName === "BUTTON" && e.target.textContent === "" && myTurn) {
    const index = Array.from(board.children).indexOf(e.target);
    ws.send(JSON.stringify({ type: "move", index }));
    e.target.textContent = mySymbol;
    myTurn = false;
    updateTurnMessage();
  }
});
