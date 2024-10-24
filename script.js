var cursor = true;
var speed = 500;
setInterval(() => {
  if (cursor) {
    document.getElementById("cursor").style.opacity = 0;
    cursor = false;
  }else {
    document.getElementById("cursor").style.opacity = 1;
    cursor = true;
  }
}, speed);

//document.getElementById("input-box").blur(function (event) {
// setTimeout(function () { document.getElementById("#input-box").focus(); }, 20);
//);

document.getElementById("input-box").onkeyup = function() {
  document.getElementById("input-box").value = "penyu";
};
