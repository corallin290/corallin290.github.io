var fileSystem = {
  // TODO(aurin)
  "about_me": "TODO",
  "misc": {
    "test1": "text text",
    "text2": "abcde fjkla;s"
  }
};
var cwd = [{name:"", object:fileSystem}];

function _is_file(obj) {
  return typeof dstObj === 'string' || dstObj instanceof String;
}
function _is_directory(obj) {
  return !_is_file(obj);
}
function _directory_contains(dirObj, target) {
  return Object.hasOwn(dirObj, target);
}
function _directory_get(dirObj, target) {
  return dirObj[target];
}
function _get_cwd_obj() {
  return cwd[cwd.length-1].object;
}
function _cwd_contains(target) {
  return _directory_contains(_get_cwd_obj(), target);
}
function _cwd_get(target) {
  return _directory_get(_get_cwd_obj(), target);
}

function cmd_cat(args) {
  if (args.length == 1) {
    return {returnCode:1, stdout:"", stderr:args[0]+": Expected file name"};
  }
  if (args.length > 2) {
    return {returnCode:1, stdout:"", stderr:args[0]+": Too many arguments"};
  }

  dst = args[1];
  if ( ! _cwd_contains(dst)) {
    return {returnCode:1, stdout:"", stderr:args[0]+": No file named "+dst};
  }
  dstObj = _cwd_get(dst);
  if ( ! _is_file(dstObj)) {
    return {returnCode:1, stdout:"", stderr:args[0]+": "+dst+" is not a file"};
  }

  return {returnCode:0, stdout:dstObj, stderr:""};
}

function cmd_pwd(args) {
  var p = [];
  for (let i = 1; i < cwd.length; i++) {
    p.push(cwd[i].name);
  }
  return {returnCode:0, stdout:"/"+p.join("/"), stderr:""};
};

function cmd_ls(args) {
  root = cwd[cwd.length-1].object;
  nodes = []
  for (var node in root) {
    nodes.push(node)
  }
  return {returnCode:0, stdout:nodes.join("\n"), stderr:""};
};

function _cd_single(dst) {
  if (dst == ".") {
    return {returnCode:0, stdout:"", stderr:""};
  }
  if (dst == '..') {
    if (cwd.length == 1) {
      return {returnCode:1, stdout:"", stderr:"Already at root"};
    }
    cwd.pop();
    return {returnCode:0, stdout:"", stderr:""};
  }
  if ( ! _cwd_contains(dst)) {
    return {returnCode:1, stdout:"", stderr:"No directory named "+dst};
  }
  dstObj = _cwd_get(dst);
  if ( ! _is_directory(dstObj)) {
    return {returnCode:1, stdout:"", stderr:dst+" is not a directory"};
  }

  cwd.push({name:dst, object:dstObj});
  return {returnCode:0, stdout:"", stderr:""};
}

function cmd_cd(args) {
  if (args.length == 1) {
    return {returnCode:1, stdout:"", stderr:args[0]+": Expected directory name"};
  }
  if (args.length > 2) {
    return {returnCode:1, stdout:"", stderr:args[0]+": Too many arguments"};
  }
  dst = args[1].split("/");
  console.log(dst);

  for (let i = 0; i < dst.length; i++) {
    response = _cd_single(dst[i]);
    if (response.returnCode != 0) {
      if (response.stderr.length > 0) {
        response.stderr = args[0]+": "+response.stderr;
      }
      return response;
    }
  }

  return {returnCode:0, stdout:"", stderr:""};
};

function cmd_help(args) {
  return {
    returnCode: 0,
    // TODO(aurin)
    stdout: "TODO",
    stderr: ""
  };
};

function handleCmdResponse(response) {
  if (response.returnCode == 0) { return response.stdout; }
  else if (response.returnCode == 1) { return response.stderr; }
  else { return response.stdout+" "+response.stderr; }
};

function handleCommand(args) {
  if (args.length == 0) {
    return "";
  } else if (args[0] == "cd") {
    response = cmd_cd(args);
  } else if (args[0] == "ls") {
    response = cmd_ls(args);
  } else if (args[0] == "pwd") {
    response = cmd_pwd(args);
  } else if (args[0] == "cat") {
    response = cmd_cat(args);
  } else {
    response = {
      returnCode: 1,
      stdout: "",
      stderr: "Unknown command "+args[0]+". Try typing 'help' for a list of valid commands."
    };
  }
  return handleCmdResponse(response);
};


function updateDisplayHistory(response) {
  displayHistory = document.getElementById("display-history");
  current = displayHistory.innerHTML;
  if (response.length > 0) {
    current = current + response + "\n";
    displayHistory.innerHTML = current;
  }
};


inputBox = document.getElementById("input-box");

// Update display whenever new text is entered
function updateInputDisplay(inputBox) {
  inputDisplay = document.getElementById("input-display-before")
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
    inputText = this.value;
    this.value = "";
    updateInputDisplay(this);
    updateDisplayHistory("> "+inputText);

    console.log("command: "+inputText);

    var args = inputText.split(" ");
    response = handleCommand(args);
    updateDisplayHistory(response);
  } else {
    // Always update immediately
    updateInputDisplay(this);
  }
};
