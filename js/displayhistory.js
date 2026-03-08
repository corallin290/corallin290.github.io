displayHistory = document.getElementById("display-history");

function updateDisplayHistory(response) {
  let current = displayHistory.innerHTML;
  if (response.length > 0) {
    current = current + response + "\n";
    displayHistory.innerHTML = current;
  }
};

function clearDisplayHistory() {
  const current = displayHistory.innerHTML;
  displayHistory.innerHTML = "";
  return current;
}
