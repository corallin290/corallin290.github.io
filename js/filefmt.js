function _fmt_page_md_heading(count) {
  if (count < 3) {
    const heading = count + 1;
    return [`<h${heading} style="margin:0; padding:0;">`,`hh${heading}`];
  } else if (count == 3) {
    return [`<div style="font-weight:bold;">`,`hdiv`];
  } else {
    return [`<div style="font-style:italic;">`,`hdiv`];
  }
}

function _fmt_page_md(raw_string) {
  let stack = [""];
  let formatted_string = "";
  let i = 0;
  while (i < raw_string.length) {
    let character = raw_string[i];
    if (character === "#") {
      let count = 1;
      while (i+count < raw_string.length && raw_string[i+count] === "#") {
        count++;
      }
      i = i + count;
      let fmt = _fmt_page_md_heading(count);
      formatted_string += fmt[0];
      stack.push(fmt[1]);
    } else if (character === "\n" && stack[stack.length-1].startsWith("h")) {
      const tag = stack.pop();
      formatted_string += `</${tag.substring(1,tag.length)}>`;
      i = i + 1;
    } else if (character == "*" && i+1 < raw_string.length && raw_string[i+1] == "*") {
      if (stack[stack.length-1] === "b") {
        formatted_string += "</b>";
        stack.pop();
      } else {
        formatted_string += "<b>";
        stack.push("b");
      }
      i = i + 2;
    } else if (character == "_" && i+1 < raw_string.length && raw_string[i+1] == "_") {
      if (stack[stack.length-1] === "i") {
        formatted_string += "</i>";
        stack.pop();
      } else {
        formatted_string += "<i>";
        stack.push("i");
      }
      i = i + 2;
    } else {
      const m = raw_string.substring(i,raw_string.length).match(/^\[([^\]]+)\]\(([^\)]+)\)/)
      if (m !== null) {
        console.log(m);
      }
      formatted_string += character;
      i++;
    }
  }
  return formatted_string;
}

function _cmd_cat(page, func) {
  if (func === null) {
    func = window["_get_page_"+page];
    if (typeof func === 'undefined') {
      func = _get_page_todo;
    }
  }
  const raw_string = func().trim();
  const formatted_string = _fmt_page_md(raw_string);
  return formatted_string;
}
