inputBox = document.getElementById("input-box");

// Update display whenever new text is entered
function updateInputDisplay(inputBox) {
  const inputDisplay = document.getElementById("input-display-before")
  inputDisplay.innerHTML = inputBox.value + "█";
};
inputBox.onkeyup = function() { updateInputDisplay(this); };

// Prevent text selection in input box
inputBox.onselect = function() {
  this.selectionStart = this.selectionEnd;
};

// Force focus on input box
inputBox.focus();
inputBox.onblur = function() {
  setTimeout(function () { document.getElementById("input-box").focus(); }, 20);
};

inputBox.onkeydown = function(e) {
  if (e.keyCode == 37 || e.keyCode == 39) {
    // Prevent cursor movement
    e.preventDefault();
  } else if (e.keyCode == 13) {
    const inputText = this.value;
    this.value = "";
    updateInputDisplay(this);
    updateDisplayHistory("> "+inputText);

    const args = inputText.split(" ");
    const response = handleCommand(args);
    updateDisplayHistory(response);
  } else {
    // Always update immediately
    updateInputDisplay(this);
  }
};
