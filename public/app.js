document.addEventListener("DOMContentLoaded", () => {
  const gameId = window.location.pathname.split("/")[2]; // Extract game ID from the URL
  const ws = new WebSocket(`ws://${window.location.host}/game/${gameId}`);
  const board = document.getElementById("board");
  const playerInfo = document.getElementById("playerInfo");
  const gameStatus = document.getElementById("gameStatus");
  let mySymbol = "";
  let myTurn = false;

  function updateTurnMessage() {
    gameStatus.textContent = myTurn
      ? "Your turn"
      : "Waiting for the other player";
  }

  function resetBoard() {
    Array.from(board.children).forEach((cell) => (cell.textContent = ""));
    updateTurnMessage();
  }

  ws.onopen = function () {
    console.log("Connected to the server");
  };

  ws.onmessage = function (event) {
    const response = JSON.parse(event.data);
    handleServerMessages(response);
  };

  ws.onclose = function () {
    console.log("Disconnected from the server");
    gameStatus.textContent = "Disconnected from the game";
  };

  function handleServerMessages(data) {
    switch (data.type) {
      case "role":
        mySymbol = data.player;
        playerInfo.textContent = `You are ${mySymbol}`;
        break;
      case "start":
        gameStatus.textContent = data.message;
        myTurn = data.yourTurn;
        updateTurnMessage();
        break;
      case "move":
        board.children[data.index].textContent = data.player;
        myTurn = data.player !== mySymbol;
        updateTurnMessage();
        break;
      case "win":
        gameStatus.textContent =
          data.player === mySymbol
            ? "Congratulations, you won!"
            : "Sorry, you lost.";
        break;
      case "tie":
        gameStatus.textContent = "The game is a tie!";
        break;
      case "turn":
        myTurn = data.turn === (mySymbol === "X" ? 0 : 1);
        updateTurnMessage();
        break;
      case "reset":
        resetBoard();
        break;
    }
  }

  board.addEventListener("click", function (e) {
    if (
      e.target.tagName === "BUTTON" &&
      e.target.textContent === "" &&
      myTurn
    ) {
      const index = Array.from(board.children).indexOf(e.target);
      ws.send(JSON.stringify({ type: "move", index: index }));
      e.target.textContent = mySymbol;
      myTurn = false;
      updateTurnMessage();
    }
  });
});
