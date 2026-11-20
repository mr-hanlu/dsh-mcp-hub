window.__ModuleLoader__.load({id:'dsh-mcp-hub',factory(require){var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/plugin.jsx
var plugin_exports = {};
__export(plugin_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(plugin_exports);
var import_react3 = __toESM(require("react"), 1);

// src/client/App.jsx
var import_react2 = __toESM(require("react"), 1);

// node_modules/jsonc-parser/lib/esm/impl/scanner.js
function createScanner(text, ignoreTrivia = false) {
  const len = text.length;
  let pos = 0, value = "", tokenOffset = 0, token = 16, lineNumber = 0, lineStartOffset = 0, tokenLineStartOffset = 0, prevTokenLineStartOffset = 0, scanError = 0;
  function scanHexDigits(count, exact) {
    let digits = 0;
    let value2 = 0;
    while (digits < count || !exact) {
      let ch = text.charCodeAt(pos);
      if (ch >= 48 && ch <= 57) {
        value2 = value2 * 16 + ch - 48;
      } else if (ch >= 65 && ch <= 70) {
        value2 = value2 * 16 + ch - 65 + 10;
      } else if (ch >= 97 && ch <= 102) {
        value2 = value2 * 16 + ch - 97 + 10;
      } else {
        break;
      }
      pos++;
      digits++;
    }
    if (digits < count) {
      value2 = -1;
    }
    return value2;
  }
  function setPosition(newPosition) {
    pos = newPosition;
    value = "";
    tokenOffset = 0;
    token = 16;
    scanError = 0;
  }
  function scanNumber() {
    let start = pos;
    if (text.charCodeAt(pos) === 48) {
      pos++;
    } else {
      pos++;
      while (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos < text.length && text.charCodeAt(pos) === 46) {
      pos++;
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
      } else {
        scanError = 3;
        return text.substring(start, pos);
      }
    }
    let end = pos;
    if (pos < text.length && (text.charCodeAt(pos) === 69 || text.charCodeAt(pos) === 101)) {
      pos++;
      if (pos < text.length && text.charCodeAt(pos) === 43 || text.charCodeAt(pos) === 45) {
        pos++;
      }
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
        end = pos;
      } else {
        scanError = 3;
      }
    }
    return text.substring(start, end);
  }
  function scanString() {
    let result = "", start = pos;
    while (true) {
      if (pos >= len) {
        result += text.substring(start, pos);
        scanError = 2;
        break;
      }
      const ch = text.charCodeAt(pos);
      if (ch === 34) {
        result += text.substring(start, pos);
        pos++;
        break;
      }
      if (ch === 92) {
        result += text.substring(start, pos);
        pos++;
        if (pos >= len) {
          scanError = 2;
          break;
        }
        const ch2 = text.charCodeAt(pos++);
        switch (ch2) {
          case 34:
            result += '"';
            break;
          case 92:
            result += "\\";
            break;
          case 47:
            result += "/";
            break;
          case 98:
            result += "\b";
            break;
          case 102:
            result += "\f";
            break;
          case 110:
            result += "\n";
            break;
          case 114:
            result += "\r";
            break;
          case 116:
            result += "	";
            break;
          case 117:
            const ch3 = scanHexDigits(4, true);
            if (ch3 >= 0) {
              result += String.fromCharCode(ch3);
            } else {
              scanError = 4;
            }
            break;
          default:
            scanError = 5;
        }
        start = pos;
        continue;
      }
      if (ch >= 0 && ch <= 31) {
        if (isLineBreak(ch)) {
          result += text.substring(start, pos);
          scanError = 2;
          break;
        } else {
          scanError = 6;
        }
      }
      pos++;
    }
    return result;
  }
  function scanNext() {
    value = "";
    scanError = 0;
    tokenOffset = pos;
    lineStartOffset = lineNumber;
    prevTokenLineStartOffset = tokenLineStartOffset;
    if (pos >= len) {
      tokenOffset = len;
      return token = 17;
    }
    let code = text.charCodeAt(pos);
    if (isWhiteSpace(code)) {
      do {
        pos++;
        value += String.fromCharCode(code);
        code = text.charCodeAt(pos);
      } while (isWhiteSpace(code));
      return token = 15;
    }
    if (isLineBreak(code)) {
      pos++;
      value += String.fromCharCode(code);
      if (code === 13 && text.charCodeAt(pos) === 10) {
        pos++;
        value += "\n";
      }
      lineNumber++;
      tokenLineStartOffset = pos;
      return token = 14;
    }
    switch (code) {
      // tokens: []{}:,
      case 123:
        pos++;
        return token = 1;
      case 125:
        pos++;
        return token = 2;
      case 91:
        pos++;
        return token = 3;
      case 93:
        pos++;
        return token = 4;
      case 58:
        pos++;
        return token = 6;
      case 44:
        pos++;
        return token = 5;
      // strings
      case 34:
        pos++;
        value = scanString();
        return token = 10;
      // comments
      case 47:
        const start = pos - 1;
        if (text.charCodeAt(pos + 1) === 47) {
          pos += 2;
          while (pos < len) {
            if (isLineBreak(text.charCodeAt(pos))) {
              break;
            }
            pos++;
          }
          value = text.substring(start, pos);
          return token = 12;
        }
        if (text.charCodeAt(pos + 1) === 42) {
          pos += 2;
          const safeLength = len - 1;
          let commentClosed = false;
          while (pos < safeLength) {
            const ch = text.charCodeAt(pos);
            if (ch === 42 && text.charCodeAt(pos + 1) === 47) {
              pos += 2;
              commentClosed = true;
              break;
            }
            pos++;
            if (isLineBreak(ch)) {
              if (ch === 13 && text.charCodeAt(pos) === 10) {
                pos++;
              }
              lineNumber++;
              tokenLineStartOffset = pos;
            }
          }
          if (!commentClosed) {
            pos++;
            scanError = 1;
          }
          value = text.substring(start, pos);
          return token = 13;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
      // numbers
      case 45:
        value += String.fromCharCode(code);
        pos++;
        if (pos === len || !isDigit(text.charCodeAt(pos))) {
          return token = 16;
        }
      // found a minus, followed by a number so
      // we fall through to proceed with scanning
      // numbers
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        value += scanNumber();
        return token = 11;
      // literals and unknown symbols
      default:
        while (pos < len && isUnknownContentCharacter(code)) {
          pos++;
          code = text.charCodeAt(pos);
        }
        if (tokenOffset !== pos) {
          value = text.substring(tokenOffset, pos);
          switch (value) {
            case "true":
              return token = 8;
            case "false":
              return token = 9;
            case "null":
              return token = 7;
          }
          return token = 16;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
    }
  }
  function isUnknownContentCharacter(code) {
    if (isWhiteSpace(code) || isLineBreak(code)) {
      return false;
    }
    switch (code) {
      case 125:
      case 93:
      case 123:
      case 91:
      case 34:
      case 58:
      case 44:
      case 47:
        return false;
    }
    return true;
  }
  function scanNextNonTrivia() {
    let result;
    do {
      result = scanNext();
    } while (result >= 12 && result <= 15);
    return result;
  }
  return {
    setPosition,
    getPosition: () => pos,
    scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
    getToken: () => token,
    getTokenValue: () => value,
    getTokenOffset: () => tokenOffset,
    getTokenLength: () => pos - tokenOffset,
    getTokenStartLine: () => lineStartOffset,
    getTokenStartCharacter: () => tokenOffset - prevTokenLineStartOffset,
    getTokenError: () => scanError
  };
}
function isWhiteSpace(ch) {
  return ch === 32 || ch === 9;
}
function isLineBreak(ch) {
  return ch === 10 || ch === 13;
}
function isDigit(ch) {
  return ch >= 48 && ch <= 57;
}
var CharacterCodes;
(function(CharacterCodes2) {
  CharacterCodes2[CharacterCodes2["lineFeed"] = 10] = "lineFeed";
  CharacterCodes2[CharacterCodes2["carriageReturn"] = 13] = "carriageReturn";
  CharacterCodes2[CharacterCodes2["space"] = 32] = "space";
  CharacterCodes2[CharacterCodes2["_0"] = 48] = "_0";
  CharacterCodes2[CharacterCodes2["_1"] = 49] = "_1";
  CharacterCodes2[CharacterCodes2["_2"] = 50] = "_2";
  CharacterCodes2[CharacterCodes2["_3"] = 51] = "_3";
  CharacterCodes2[CharacterCodes2["_4"] = 52] = "_4";
  CharacterCodes2[CharacterCodes2["_5"] = 53] = "_5";
  CharacterCodes2[CharacterCodes2["_6"] = 54] = "_6";
  CharacterCodes2[CharacterCodes2["_7"] = 55] = "_7";
  CharacterCodes2[CharacterCodes2["_8"] = 56] = "_8";
  CharacterCodes2[CharacterCodes2["_9"] = 57] = "_9";
  CharacterCodes2[CharacterCodes2["a"] = 97] = "a";
  CharacterCodes2[CharacterCodes2["b"] = 98] = "b";
  CharacterCodes2[CharacterCodes2["c"] = 99] = "c";
  CharacterCodes2[CharacterCodes2["d"] = 100] = "d";
  CharacterCodes2[CharacterCodes2["e"] = 101] = "e";
  CharacterCodes2[CharacterCodes2["f"] = 102] = "f";
  CharacterCodes2[CharacterCodes2["g"] = 103] = "g";
  CharacterCodes2[CharacterCodes2["h"] = 104] = "h";
  CharacterCodes2[CharacterCodes2["i"] = 105] = "i";
  CharacterCodes2[CharacterCodes2["j"] = 106] = "j";
  CharacterCodes2[CharacterCodes2["k"] = 107] = "k";
  CharacterCodes2[CharacterCodes2["l"] = 108] = "l";
  CharacterCodes2[CharacterCodes2["m"] = 109] = "m";
  CharacterCodes2[CharacterCodes2["n"] = 110] = "n";
  CharacterCodes2[CharacterCodes2["o"] = 111] = "o";
  CharacterCodes2[CharacterCodes2["p"] = 112] = "p";
  CharacterCodes2[CharacterCodes2["q"] = 113] = "q";
  CharacterCodes2[CharacterCodes2["r"] = 114] = "r";
  CharacterCodes2[CharacterCodes2["s"] = 115] = "s";
  CharacterCodes2[CharacterCodes2["t"] = 116] = "t";
  CharacterCodes2[CharacterCodes2["u"] = 117] = "u";
  CharacterCodes2[CharacterCodes2["v"] = 118] = "v";
  CharacterCodes2[CharacterCodes2["w"] = 119] = "w";
  CharacterCodes2[CharacterCodes2["x"] = 120] = "x";
  CharacterCodes2[CharacterCodes2["y"] = 121] = "y";
  CharacterCodes2[CharacterCodes2["z"] = 122] = "z";
  CharacterCodes2[CharacterCodes2["A"] = 65] = "A";
  CharacterCodes2[CharacterCodes2["B"] = 66] = "B";
  CharacterCodes2[CharacterCodes2["C"] = 67] = "C";
  CharacterCodes2[CharacterCodes2["D"] = 68] = "D";
  CharacterCodes2[CharacterCodes2["E"] = 69] = "E";
  CharacterCodes2[CharacterCodes2["F"] = 70] = "F";
  CharacterCodes2[CharacterCodes2["G"] = 71] = "G";
  CharacterCodes2[CharacterCodes2["H"] = 72] = "H";
  CharacterCodes2[CharacterCodes2["I"] = 73] = "I";
  CharacterCodes2[CharacterCodes2["J"] = 74] = "J";
  CharacterCodes2[CharacterCodes2["K"] = 75] = "K";
  CharacterCodes2[CharacterCodes2["L"] = 76] = "L";
  CharacterCodes2[CharacterCodes2["M"] = 77] = "M";
  CharacterCodes2[CharacterCodes2["N"] = 78] = "N";
  CharacterCodes2[CharacterCodes2["O"] = 79] = "O";
  CharacterCodes2[CharacterCodes2["P"] = 80] = "P";
  CharacterCodes2[CharacterCodes2["Q"] = 81] = "Q";
  CharacterCodes2[CharacterCodes2["R"] = 82] = "R";
  CharacterCodes2[CharacterCodes2["S"] = 83] = "S";
  CharacterCodes2[CharacterCodes2["T"] = 84] = "T";
  CharacterCodes2[CharacterCodes2["U"] = 85] = "U";
  CharacterCodes2[CharacterCodes2["V"] = 86] = "V";
  CharacterCodes2[CharacterCodes2["W"] = 87] = "W";
  CharacterCodes2[CharacterCodes2["X"] = 88] = "X";
  CharacterCodes2[CharacterCodes2["Y"] = 89] = "Y";
  CharacterCodes2[CharacterCodes2["Z"] = 90] = "Z";
  CharacterCodes2[CharacterCodes2["asterisk"] = 42] = "asterisk";
  CharacterCodes2[CharacterCodes2["backslash"] = 92] = "backslash";
  CharacterCodes2[CharacterCodes2["closeBrace"] = 125] = "closeBrace";
  CharacterCodes2[CharacterCodes2["closeBracket"] = 93] = "closeBracket";
  CharacterCodes2[CharacterCodes2["colon"] = 58] = "colon";
  CharacterCodes2[CharacterCodes2["comma"] = 44] = "comma";
  CharacterCodes2[CharacterCodes2["dot"] = 46] = "dot";
  CharacterCodes2[CharacterCodes2["doubleQuote"] = 34] = "doubleQuote";
  CharacterCodes2[CharacterCodes2["minus"] = 45] = "minus";
  CharacterCodes2[CharacterCodes2["openBrace"] = 123] = "openBrace";
  CharacterCodes2[CharacterCodes2["openBracket"] = 91] = "openBracket";
  CharacterCodes2[CharacterCodes2["plus"] = 43] = "plus";
  CharacterCodes2[CharacterCodes2["slash"] = 47] = "slash";
  CharacterCodes2[CharacterCodes2["formFeed"] = 12] = "formFeed";
  CharacterCodes2[CharacterCodes2["tab"] = 9] = "tab";
})(CharacterCodes || (CharacterCodes = {}));

// node_modules/jsonc-parser/lib/esm/impl/string-intern.js
var cachedSpaces = new Array(20).fill(0).map((_, index) => {
  return " ".repeat(index);
});
var maxCachedValues = 200;
var cachedBreakLinesWithSpaces = {
  " ": {
    "\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\n" + " ".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r" + " ".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r\n" + " ".repeat(index);
    })
  },
  "	": {
    "\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\n" + "	".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r" + "	".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r\n" + "	".repeat(index);
    })
  }
};
var supportedEols = ["\n", "\r", "\r\n"];

// node_modules/jsonc-parser/lib/esm/impl/format.js
function format(documentText, range, options) {
  let initialIndentLevel;
  let formatText;
  let formatTextStart;
  let rangeStart;
  let rangeEnd;
  if (range) {
    rangeStart = range.offset;
    rangeEnd = rangeStart + range.length;
    formatTextStart = rangeStart;
    while (formatTextStart > 0 && !isEOL(documentText, formatTextStart - 1)) {
      formatTextStart--;
    }
    let endOffset = rangeEnd;
    while (endOffset < documentText.length && !isEOL(documentText, endOffset)) {
      endOffset++;
    }
    formatText = documentText.substring(formatTextStart, endOffset);
    initialIndentLevel = computeIndentLevel(formatText, options);
  } else {
    formatText = documentText;
    initialIndentLevel = 0;
    formatTextStart = 0;
    rangeStart = 0;
    rangeEnd = documentText.length;
  }
  const eol = getEOL(options, documentText);
  const eolFastPathSupported = supportedEols.includes(eol);
  let numberLineBreaks = 0;
  let indentLevel = 0;
  let indentValue;
  if (options.insertSpaces) {
    indentValue = cachedSpaces[options.tabSize || 4] ?? repeat(cachedSpaces[1], options.tabSize || 4);
  } else {
    indentValue = "	";
  }
  const indentType = indentValue === "	" ? "	" : " ";
  let scanner = createScanner(formatText, false);
  let hasError = false;
  function newLinesAndIndent() {
    if (numberLineBreaks > 1) {
      return repeat(eol, numberLineBreaks) + repeat(indentValue, initialIndentLevel + indentLevel);
    }
    const amountOfSpaces = indentValue.length * (initialIndentLevel + indentLevel);
    if (!eolFastPathSupported || amountOfSpaces > cachedBreakLinesWithSpaces[indentType][eol].length) {
      return eol + repeat(indentValue, initialIndentLevel + indentLevel);
    }
    if (amountOfSpaces <= 0) {
      return eol;
    }
    return cachedBreakLinesWithSpaces[indentType][eol][amountOfSpaces];
  }
  function scanNext() {
    let token = scanner.scan();
    numberLineBreaks = 0;
    while (token === 15 || token === 14) {
      if (token === 14 && options.keepLines) {
        numberLineBreaks += 1;
      } else if (token === 14) {
        numberLineBreaks = 1;
      }
      token = scanner.scan();
    }
    hasError = token === 16 || scanner.getTokenError() !== 0;
    return token;
  }
  const editOperations = [];
  function addEdit(text, startOffset, endOffset) {
    if (!hasError && (!range || startOffset < rangeEnd && endOffset > rangeStart) && documentText.substring(startOffset, endOffset) !== text) {
      editOperations.push({ offset: startOffset, length: endOffset - startOffset, content: text });
    }
  }
  let firstToken = scanNext();
  if (options.keepLines && numberLineBreaks > 0) {
    addEdit(repeat(eol, numberLineBreaks), 0, 0);
  }
  if (firstToken !== 17) {
    let firstTokenStart = scanner.getTokenOffset() + formatTextStart;
    let initialIndent = indentValue.length * initialIndentLevel < 20 && options.insertSpaces ? cachedSpaces[indentValue.length * initialIndentLevel] : repeat(indentValue, initialIndentLevel);
    addEdit(initialIndent, formatTextStart, firstTokenStart);
  }
  while (firstToken !== 17) {
    let firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
    let secondToken = scanNext();
    let replaceContent = "";
    let needsLineBreak = false;
    while (numberLineBreaks === 0 && (secondToken === 12 || secondToken === 13)) {
      let commentTokenStart = scanner.getTokenOffset() + formatTextStart;
      addEdit(cachedSpaces[1], firstTokenEnd, commentTokenStart);
      firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
      needsLineBreak = secondToken === 12;
      replaceContent = needsLineBreak ? newLinesAndIndent() : "";
      secondToken = scanNext();
    }
    if (secondToken === 2) {
      if (firstToken !== 1) {
        indentLevel--;
      }
      ;
      if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== 1) {
        replaceContent = newLinesAndIndent();
      } else if (options.keepLines) {
        replaceContent = cachedSpaces[1];
      }
    } else if (secondToken === 4) {
      if (firstToken !== 3) {
        indentLevel--;
      }
      ;
      if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== 3) {
        replaceContent = newLinesAndIndent();
      } else if (options.keepLines) {
        replaceContent = cachedSpaces[1];
      }
    } else {
      switch (firstToken) {
        case 3:
        case 1:
          indentLevel++;
          if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
            replaceContent = newLinesAndIndent();
          } else {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 5:
          if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
            replaceContent = newLinesAndIndent();
          } else {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 12:
          replaceContent = newLinesAndIndent();
          break;
        case 13:
          if (numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (!needsLineBreak) {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 6:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (!needsLineBreak) {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 10:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (secondToken === 6 && !needsLineBreak) {
            replaceContent = "";
          }
          break;
        case 7:
        case 8:
        case 9:
        case 11:
        case 2:
        case 4:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else {
            if ((secondToken === 12 || secondToken === 13) && !needsLineBreak) {
              replaceContent = cachedSpaces[1];
            } else if (secondToken !== 5 && secondToken !== 17) {
              hasError = true;
            }
          }
          break;
        case 16:
          hasError = true;
          break;
      }
      if (numberLineBreaks > 0 && (secondToken === 12 || secondToken === 13)) {
        replaceContent = newLinesAndIndent();
      }
    }
    if (secondToken === 17) {
      if (options.keepLines && numberLineBreaks > 0) {
        replaceContent = newLinesAndIndent();
      } else {
        replaceContent = options.insertFinalNewline ? eol : "";
      }
    }
    const secondTokenStart = scanner.getTokenOffset() + formatTextStart;
    addEdit(replaceContent, firstTokenEnd, secondTokenStart);
    firstToken = secondToken;
  }
  return editOperations;
}
function repeat(s, count) {
  let result = "";
  for (let i = 0; i < count; i++) {
    result += s;
  }
  return result;
}
function computeIndentLevel(content, options) {
  let i = 0;
  let nChars = 0;
  const tabSize = options.tabSize || 4;
  while (i < content.length) {
    let ch = content.charAt(i);
    if (ch === cachedSpaces[1]) {
      nChars++;
    } else if (ch === "	") {
      nChars += tabSize;
    } else {
      break;
    }
    i++;
  }
  return Math.floor(nChars / tabSize);
}
function getEOL(options, text) {
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === "\r") {
      if (i + 1 < text.length && text.charAt(i + 1) === "\n") {
        return "\r\n";
      }
      return "\r";
    } else if (ch === "\n") {
      return "\n";
    }
  }
  return options && options.eol || "\n";
}
function isEOL(text, offset) {
  return "\r\n".indexOf(text.charAt(offset)) !== -1;
}

// node_modules/jsonc-parser/lib/esm/impl/parser.js
var ParseOptions;
(function(ParseOptions2) {
  ParseOptions2.DEFAULT = {
    allowTrailingComma: false
  };
})(ParseOptions || (ParseOptions = {}));
function parse(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentProperty = null;
  let currentParent = [];
  const previousParents = [];
  function onValue(value) {
    if (Array.isArray(currentParent)) {
      currentParent.push(value);
    } else if (currentProperty !== null) {
      currentParent[currentProperty] = value;
    }
  }
  const visitor = {
    onObjectBegin: () => {
      const object2 = {};
      onValue(object2);
      previousParents.push(currentParent);
      currentParent = object2;
      currentProperty = null;
    },
    onObjectProperty: (name) => {
      currentProperty = name;
    },
    onObjectEnd: () => {
      currentParent = previousParents.pop();
    },
    onArrayBegin: () => {
      const array = [];
      onValue(array);
      previousParents.push(currentParent);
      currentParent = array;
      currentProperty = null;
    },
    onArrayEnd: () => {
      currentParent = previousParents.pop();
    },
    onLiteralValue: onValue,
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text, visitor, options);
  return currentParent[0];
}
function parseTree(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentParent = { type: "array", offset: -1, length: -1, children: [], parent: void 0 };
  function ensurePropertyComplete(endOffset) {
    if (currentParent.type === "property") {
      currentParent.length = endOffset - currentParent.offset;
      currentParent = currentParent.parent;
    }
  }
  function onValue(valueNode) {
    currentParent.children.push(valueNode);
    return valueNode;
  }
  const visitor = {
    onObjectBegin: (offset) => {
      currentParent = onValue({ type: "object", offset, length: -1, parent: currentParent, children: [] });
    },
    onObjectProperty: (name, offset, length) => {
      currentParent = onValue({ type: "property", offset, length: -1, parent: currentParent, children: [] });
      currentParent.children.push({ type: "string", value: name, offset, length, parent: currentParent });
    },
    onObjectEnd: (offset, length) => {
      ensurePropertyComplete(offset + length);
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onArrayBegin: (offset, length) => {
      currentParent = onValue({ type: "array", offset, length: -1, parent: currentParent, children: [] });
    },
    onArrayEnd: (offset, length) => {
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onLiteralValue: (value, offset, length) => {
      onValue({ type: getNodeType(value), offset, length, parent: currentParent, value });
      ensurePropertyComplete(offset + length);
    },
    onSeparator: (sep, offset, length) => {
      if (currentParent.type === "property") {
        if (sep === ":") {
          currentParent.colonOffset = offset;
        } else if (sep === ",") {
          ensurePropertyComplete(offset);
        }
      }
    },
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text, visitor, options);
  const result = currentParent.children[0];
  if (result) {
    delete result.parent;
  }
  return result;
}
function findNodeAtLocation(root, path) {
  if (!root) {
    return void 0;
  }
  let node = root;
  for (let segment of path) {
    if (typeof segment === "string") {
      if (node.type !== "object" || !Array.isArray(node.children)) {
        return void 0;
      }
      let found = false;
      for (const propertyNode of node.children) {
        if (Array.isArray(propertyNode.children) && propertyNode.children[0].value === segment && propertyNode.children.length === 2) {
          node = propertyNode.children[1];
          found = true;
          break;
        }
      }
      if (!found) {
        return void 0;
      }
    } else {
      const index = segment;
      if (node.type !== "array" || index < 0 || !Array.isArray(node.children) || index >= node.children.length) {
        return void 0;
      }
      node = node.children[index];
    }
  }
  return node;
}
function visit(text, visitor, options = ParseOptions.DEFAULT) {
  const _scanner = createScanner(text, false);
  const _jsonPath = [];
  let suppressedCallbacks = 0;
  function toNoArgVisit(visitFunction) {
    return visitFunction ? () => suppressedCallbacks === 0 && visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisit(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisitWithPath(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice()) : () => true;
  }
  function toBeginVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks++;
      } else {
        let cbReturn = visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice());
        if (cbReturn === false) {
          suppressedCallbacks = 1;
        }
      }
    } : () => true;
  }
  function toEndVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks--;
      }
      if (suppressedCallbacks === 0) {
        visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter());
      }
    } : () => true;
  }
  const onObjectBegin = toBeginVisit(visitor.onObjectBegin), onObjectProperty = toOneArgVisitWithPath(visitor.onObjectProperty), onObjectEnd = toEndVisit(visitor.onObjectEnd), onArrayBegin = toBeginVisit(visitor.onArrayBegin), onArrayEnd = toEndVisit(visitor.onArrayEnd), onLiteralValue = toOneArgVisitWithPath(visitor.onLiteralValue), onSeparator = toOneArgVisit(visitor.onSeparator), onComment = toNoArgVisit(visitor.onComment), onError = toOneArgVisit(visitor.onError);
  const disallowComments = options && options.disallowComments;
  const allowTrailingComma = options && options.allowTrailingComma;
  function scanNext() {
    while (true) {
      const token = _scanner.scan();
      switch (_scanner.getTokenError()) {
        case 4:
          handleError(
            14
            /* ParseErrorCode.InvalidUnicode */
          );
          break;
        case 5:
          handleError(
            15
            /* ParseErrorCode.InvalidEscapeCharacter */
          );
          break;
        case 3:
          handleError(
            13
            /* ParseErrorCode.UnexpectedEndOfNumber */
          );
          break;
        case 1:
          if (!disallowComments) {
            handleError(
              11
              /* ParseErrorCode.UnexpectedEndOfComment */
            );
          }
          break;
        case 2:
          handleError(
            12
            /* ParseErrorCode.UnexpectedEndOfString */
          );
          break;
        case 6:
          handleError(
            16
            /* ParseErrorCode.InvalidCharacter */
          );
          break;
      }
      switch (token) {
        case 12:
        case 13:
          if (disallowComments) {
            handleError(
              10
              /* ParseErrorCode.InvalidCommentToken */
            );
          } else {
            onComment();
          }
          break;
        case 16:
          handleError(
            1
            /* ParseErrorCode.InvalidSymbol */
          );
          break;
        case 15:
        case 14:
          break;
        default:
          return token;
      }
    }
  }
  function handleError(error, skipUntilAfter = [], skipUntil = []) {
    onError(error);
    if (skipUntilAfter.length + skipUntil.length > 0) {
      let token = _scanner.getToken();
      while (token !== 17) {
        if (skipUntilAfter.indexOf(token) !== -1) {
          scanNext();
          break;
        } else if (skipUntil.indexOf(token) !== -1) {
          break;
        }
        token = scanNext();
      }
    }
  }
  function parseString2(isValue) {
    const value = _scanner.getTokenValue();
    if (isValue) {
      onLiteralValue(value);
    } else {
      onObjectProperty(value);
      _jsonPath.push(value);
    }
    scanNext();
    return true;
  }
  function parseLiteral() {
    switch (_scanner.getToken()) {
      case 11:
        const tokenValue = _scanner.getTokenValue();
        let value = Number(tokenValue);
        if (isNaN(value)) {
          handleError(
            2
            /* ParseErrorCode.InvalidNumberFormat */
          );
          value = 0;
        }
        onLiteralValue(value);
        break;
      case 7:
        onLiteralValue(null);
        break;
      case 8:
        onLiteralValue(true);
        break;
      case 9:
        onLiteralValue(false);
        break;
      default:
        return false;
    }
    scanNext();
    return true;
  }
  function parseProperty() {
    if (_scanner.getToken() !== 10) {
      handleError(3, [], [
        2,
        5
        /* SyntaxKind.CommaToken */
      ]);
      return false;
    }
    parseString2(false);
    if (_scanner.getToken() === 6) {
      onSeparator(":");
      scanNext();
      if (!parseValue()) {
        handleError(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
    } else {
      handleError(5, [], [
        2,
        5
        /* SyntaxKind.CommaToken */
      ]);
    }
    _jsonPath.pop();
    return true;
  }
  function parseObject() {
    onObjectBegin();
    scanNext();
    let needsComma = false;
    while (_scanner.getToken() !== 2 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 2 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (!parseProperty()) {
        handleError(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
      needsComma = true;
    }
    onObjectEnd();
    if (_scanner.getToken() !== 2) {
      handleError(7, [
        2
        /* SyntaxKind.CloseBraceToken */
      ], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseArray2() {
    onArrayBegin();
    scanNext();
    let isFirstElement = true;
    let needsComma = false;
    while (_scanner.getToken() !== 4 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 4 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (isFirstElement) {
        _jsonPath.push(0);
        isFirstElement = false;
      } else {
        _jsonPath[_jsonPath.length - 1]++;
      }
      if (!parseValue()) {
        handleError(4, [], [
          4,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
      needsComma = true;
    }
    onArrayEnd();
    if (!isFirstElement) {
      _jsonPath.pop();
    }
    if (_scanner.getToken() !== 4) {
      handleError(8, [
        4
        /* SyntaxKind.CloseBracketToken */
      ], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseValue() {
    switch (_scanner.getToken()) {
      case 3:
        return parseArray2();
      case 1:
        return parseObject();
      case 10:
        return parseString2(true);
      default:
        return parseLiteral();
    }
  }
  scanNext();
  if (_scanner.getToken() === 17) {
    if (options.allowEmptyContent) {
      return true;
    }
    handleError(4, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError(4, [], []);
    return false;
  }
  if (_scanner.getToken() !== 17) {
    handleError(9, [], []);
  }
  return true;
}
function getNodeType(value) {
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "object": {
      if (!value) {
        return "null";
      } else if (Array.isArray(value)) {
        return "array";
      }
      return "object";
    }
    default:
      return "null";
  }
}

// node_modules/jsonc-parser/lib/esm/impl/edit.js
function setProperty(text, originalPath, value, options) {
  const path = originalPath.slice();
  const errors = [];
  const root = parseTree(text, errors);
  let parent = void 0;
  let lastSegment = void 0;
  while (path.length > 0) {
    lastSegment = path.pop();
    parent = findNodeAtLocation(root, path);
    if (parent === void 0 && value !== void 0) {
      if (typeof lastSegment === "string") {
        value = { [lastSegment]: value };
      } else {
        value = [value];
      }
    } else {
      break;
    }
  }
  if (!parent) {
    if (value === void 0) {
      throw new Error("Can not delete in empty document");
    }
    return withFormatting(text, { offset: root ? root.offset : 0, length: root ? root.length : 0, content: JSON.stringify(value) }, options);
  } else if (parent.type === "object" && typeof lastSegment === "string" && Array.isArray(parent.children)) {
    const existing = findNodeAtLocation(parent, [lastSegment]);
    if (existing !== void 0) {
      if (value === void 0) {
        if (!existing.parent) {
          throw new Error("Malformed AST");
        }
        const propertyIndex = parent.children.indexOf(existing.parent);
        let removeBegin;
        let removeEnd = existing.parent.offset + existing.parent.length;
        if (propertyIndex > 0) {
          let previous = parent.children[propertyIndex - 1];
          removeBegin = previous.offset + previous.length;
        } else {
          removeBegin = parent.offset + 1;
          if (parent.children.length > 1) {
            let next = parent.children[1];
            removeEnd = next.offset;
          }
        }
        return withFormatting(text, { offset: removeBegin, length: removeEnd - removeBegin, content: "" }, options);
      } else {
        return withFormatting(text, { offset: existing.offset, length: existing.length, content: JSON.stringify(value) }, options);
      }
    } else {
      if (value === void 0) {
        return [];
      }
      const newProperty = `${JSON.stringify(lastSegment)}: ${JSON.stringify(value)}`;
      const index = options.getInsertionIndex ? options.getInsertionIndex(parent.children.map((p) => p.children[0].value)) : parent.children.length;
      let edit;
      if (index > 0) {
        let previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      } else if (parent.children.length === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty };
      } else {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty + "," };
      }
      return withFormatting(text, edit, options);
    }
  } else if (parent.type === "array" && typeof lastSegment === "number" && Array.isArray(parent.children)) {
    const insertIndex = lastSegment;
    if (insertIndex === -1) {
      const newProperty = `${JSON.stringify(value)}`;
      let edit;
      if (parent.children.length === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty };
      } else {
        const previous = parent.children[parent.children.length - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      }
      return withFormatting(text, edit, options);
    } else if (value === void 0 && parent.children.length >= 0) {
      const removalIndex = lastSegment;
      const toRemove = parent.children[removalIndex];
      let edit;
      if (parent.children.length === 1) {
        edit = { offset: parent.offset + 1, length: parent.length - 2, content: "" };
      } else if (parent.children.length - 1 === removalIndex) {
        let previous = parent.children[removalIndex - 1];
        let offset = previous.offset + previous.length;
        let parentEndOffset = parent.offset + parent.length;
        edit = { offset, length: parentEndOffset - 2 - offset, content: "" };
      } else {
        edit = { offset: toRemove.offset, length: parent.children[removalIndex + 1].offset - toRemove.offset, content: "" };
      }
      return withFormatting(text, edit, options);
    } else if (value !== void 0) {
      let edit;
      const newProperty = `${JSON.stringify(value)}`;
      if (!options.isArrayInsertion && parent.children.length > lastSegment) {
        const toModify = parent.children[lastSegment];
        edit = { offset: toModify.offset, length: toModify.length, content: newProperty };
      } else if (parent.children.length === 0 || lastSegment === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: parent.children.length === 0 ? newProperty : newProperty + "," };
      } else {
        const index = lastSegment > parent.children.length ? parent.children.length : lastSegment;
        const previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      }
      return withFormatting(text, edit, options);
    } else {
      throw new Error(`Can not ${value === void 0 ? "remove" : options.isArrayInsertion ? "insert" : "modify"} Array index ${insertIndex} as length is not sufficient`);
    }
  } else {
    throw new Error(`Can not add ${typeof lastSegment !== "number" ? "index" : "property"} to parent of type ${parent.type}`);
  }
}
function withFormatting(text, edit, options) {
  if (!options.formattingOptions) {
    return [edit];
  }
  let newText = applyEdit(text, edit);
  let begin = edit.offset;
  let end = edit.offset + edit.content.length;
  if (edit.length === 0 || edit.content.length === 0) {
    while (begin > 0 && !isEOL(newText, begin - 1)) {
      begin--;
    }
    while (end < newText.length && !isEOL(newText, end)) {
      end++;
    }
  }
  const edits = format(newText, { offset: begin, length: end - begin }, { ...options.formattingOptions, keepLines: false });
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit2 = edits[i];
    newText = applyEdit(newText, edit2);
    begin = Math.min(begin, edit2.offset);
    end = Math.max(end, edit2.offset + edit2.length);
    end += edit2.content.length - edit2.length;
  }
  const editLength = text.length - (newText.length - end) - begin;
  return [{ offset: begin, length: editLength, content: newText.substring(begin, end) }];
}
function applyEdit(text, edit) {
  return text.substring(0, edit.offset) + edit.content + text.substring(edit.offset + edit.length);
}

// node_modules/jsonc-parser/lib/esm/main.js
var ScanError;
(function(ScanError2) {
  ScanError2[ScanError2["None"] = 0] = "None";
  ScanError2[ScanError2["UnexpectedEndOfComment"] = 1] = "UnexpectedEndOfComment";
  ScanError2[ScanError2["UnexpectedEndOfString"] = 2] = "UnexpectedEndOfString";
  ScanError2[ScanError2["UnexpectedEndOfNumber"] = 3] = "UnexpectedEndOfNumber";
  ScanError2[ScanError2["InvalidUnicode"] = 4] = "InvalidUnicode";
  ScanError2[ScanError2["InvalidEscapeCharacter"] = 5] = "InvalidEscapeCharacter";
  ScanError2[ScanError2["InvalidCharacter"] = 6] = "InvalidCharacter";
})(ScanError || (ScanError = {}));
var SyntaxKind;
(function(SyntaxKind2) {
  SyntaxKind2[SyntaxKind2["OpenBraceToken"] = 1] = "OpenBraceToken";
  SyntaxKind2[SyntaxKind2["CloseBraceToken"] = 2] = "CloseBraceToken";
  SyntaxKind2[SyntaxKind2["OpenBracketToken"] = 3] = "OpenBracketToken";
  SyntaxKind2[SyntaxKind2["CloseBracketToken"] = 4] = "CloseBracketToken";
  SyntaxKind2[SyntaxKind2["CommaToken"] = 5] = "CommaToken";
  SyntaxKind2[SyntaxKind2["ColonToken"] = 6] = "ColonToken";
  SyntaxKind2[SyntaxKind2["NullKeyword"] = 7] = "NullKeyword";
  SyntaxKind2[SyntaxKind2["TrueKeyword"] = 8] = "TrueKeyword";
  SyntaxKind2[SyntaxKind2["FalseKeyword"] = 9] = "FalseKeyword";
  SyntaxKind2[SyntaxKind2["StringLiteral"] = 10] = "StringLiteral";
  SyntaxKind2[SyntaxKind2["NumericLiteral"] = 11] = "NumericLiteral";
  SyntaxKind2[SyntaxKind2["LineCommentTrivia"] = 12] = "LineCommentTrivia";
  SyntaxKind2[SyntaxKind2["BlockCommentTrivia"] = 13] = "BlockCommentTrivia";
  SyntaxKind2[SyntaxKind2["LineBreakTrivia"] = 14] = "LineBreakTrivia";
  SyntaxKind2[SyntaxKind2["Trivia"] = 15] = "Trivia";
  SyntaxKind2[SyntaxKind2["Unknown"] = 16] = "Unknown";
  SyntaxKind2[SyntaxKind2["EOF"] = 17] = "EOF";
})(SyntaxKind || (SyntaxKind = {}));
var parse2 = parse;
var ParseErrorCode;
(function(ParseErrorCode2) {
  ParseErrorCode2[ParseErrorCode2["InvalidSymbol"] = 1] = "InvalidSymbol";
  ParseErrorCode2[ParseErrorCode2["InvalidNumberFormat"] = 2] = "InvalidNumberFormat";
  ParseErrorCode2[ParseErrorCode2["PropertyNameExpected"] = 3] = "PropertyNameExpected";
  ParseErrorCode2[ParseErrorCode2["ValueExpected"] = 4] = "ValueExpected";
  ParseErrorCode2[ParseErrorCode2["ColonExpected"] = 5] = "ColonExpected";
  ParseErrorCode2[ParseErrorCode2["CommaExpected"] = 6] = "CommaExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBraceExpected"] = 7] = "CloseBraceExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBracketExpected"] = 8] = "CloseBracketExpected";
  ParseErrorCode2[ParseErrorCode2["EndOfFileExpected"] = 9] = "EndOfFileExpected";
  ParseErrorCode2[ParseErrorCode2["InvalidCommentToken"] = 10] = "InvalidCommentToken";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfComment"] = 11] = "UnexpectedEndOfComment";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfString"] = 12] = "UnexpectedEndOfString";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfNumber"] = 13] = "UnexpectedEndOfNumber";
  ParseErrorCode2[ParseErrorCode2["InvalidUnicode"] = 14] = "InvalidUnicode";
  ParseErrorCode2[ParseErrorCode2["InvalidEscapeCharacter"] = 15] = "InvalidEscapeCharacter";
  ParseErrorCode2[ParseErrorCode2["InvalidCharacter"] = 16] = "InvalidCharacter";
})(ParseErrorCode || (ParseErrorCode = {}));
function modify(text, path, value, options) {
  return setProperty(text, path, value, options);
}
function applyEdits(text, edits) {
  let sortedEdits = edits.slice(0).sort((a, b) => {
    const diff = a.offset - b.offset;
    if (diff === 0) {
      return a.length - b.length;
    }
    return diff;
  });
  let lastModifiedOffset = text.length;
  for (let i = sortedEdits.length - 1; i >= 0; i--) {
    let e = sortedEdits[i];
    if (e.offset + e.length <= lastModifiedOffset) {
      text = applyEdit(text, e);
    } else {
      throw new Error("Overlapping edit");
    }
    lastModifiedOffset = e.offset;
  }
  return text;
}

// node_modules/smol-toml/dist/error.js
function getLineColFromPtr(string, ptr) {
  let lines = string.slice(0, ptr).split(/\r?\n/);
  return [lines.length, lines.pop().length + 1];
}
function makeCodeBlock(string, line, column) {
  let lines = string.split(/\r?\n/);
  let codeblock = "";
  let numberLen = (Math.log10(line + 1) | 0) + 1;
  for (let i = line - 1; i <= line + 1; i++) {
    let l = lines[i - 1];
    if (!l)
      continue;
    codeblock += i.toString().padEnd(numberLen, " ");
    codeblock += ":  ";
    codeblock += l;
    codeblock += "\n";
    if (i === line) {
      codeblock += " ".repeat(numberLen + column + 2);
      codeblock += "^\n";
    }
  }
  return codeblock;
}
var TomlError = class _TomlError extends Error {
  line;
  column;
  codeblock;
  constructor(message, options) {
    const [line, column] = getLineColFromPtr(options.toml, options.ptr);
    const codeblock = makeCodeBlock(options.toml, line, column);
    super(`Invalid TOML document: ${message}

${codeblock}`, options);
    this.line = line;
    this.column = column;
    this.codeblock = codeblock;
  }
  /** @internal */
  static x(message, ctx, ptr) {
    throw new _TomlError(message, { toml: ctx.s, ptr: ptr ?? ctx.p });
  }
};

// node_modules/smol-toml/dist/primitive.js
function parseString(ctx) {
  let startPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p++);
  let first = c;
  let isLiteral = c === 39;
  let isMultiline = c === ctx.s.charCodeAt(ctx.p) && c === ctx.s.charCodeAt(ctx.p + 1);
  if (isMultiline) {
    if ((c = ctx.s.charCodeAt(ctx.p += 2)) === 10)
      ctx.p++;
    else if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)
      ctx.p += 2;
  }
  let parsed = "";
  let sliceStart = ctx.p;
  let state = 0;
  for (; ctx.p < ctx.s.length; ctx.p++) {
    c = ctx.s.charCodeAt(ctx.p);
    if (isMultiline && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)) {
      state = state && 3;
    } else if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in strings", ctx);
    } else if ((!state || state === 3) && c === first && (!isMultiline || ctx.s.charCodeAt(ctx.p + 1) === first && ctx.s.charCodeAt(ctx.p + 2) === first)) {
      if (isMultiline) {
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
      }
      if (!state) {
        let s = ctx.s.slice(sliceStart, ctx.p);
        parsed = parsed ? parsed + s : s;
      }
      ctx.p += isMultiline ? 3 : 1;
      return parsed;
    } else if (!state) {
      if (!isLiteral && c === 92) {
        parsed += ctx.s.slice(sliceStart, sliceStart = ctx.p);
        state = 1;
      }
    } else if (state === 1) {
      if (c === 120 || c === 117 || c === 85) {
        let errPtr = ctx.p++ - 1;
        let value = 0;
        let len = c === 120 ? 2 : c === 117 ? 4 : 8;
        for (let j = 0; j < len; j++, ctx.p++) {
          let hex = ctx.s.charCodeAt(ctx.p);
          let digit = (
            /* 0-9 */
            hex >= 48 && hex <= 57 ? hex - 48 : (
              /* A-F */
              hex >= 65 && hex <= 70 ? hex - 65 + 10 : (
                /* a-f */
                hex >= 97 && hex <= 102 ? hex - 97 + 10 : -1
              )
            )
          );
          if (digit < 0)
            TomlError.x("invalid non-hex character in unicode escape", ctx);
          value = value << 4 | digit;
        }
        if (value < 0 || value > 1114111 || value >= 55296 && value <= 57343) {
          TomlError.x("invalid unicode escape", ctx, errPtr);
        }
        parsed += String.fromCodePoint(value);
        sliceStart = ctx.p--;
        state = 0;
      } else if (isMultiline && (c === 32 || c === 9)) {
        state = 2;
      } else {
        if (c === 98)
          parsed += "\b";
        else if (c === 116)
          parsed += "	";
        else if (c === 110)
          parsed += "\n";
        else if (c === 102)
          parsed += "\f";
        else if (c === 114)
          parsed += "\r";
        else if (c === 101)
          parsed += "\x1B";
        else if (c === 34)
          parsed += '"';
        else if (c === 92)
          parsed += "\\";
        else
          TomlError.x("unrecognised escape sequence", ctx);
        sliceStart = ctx.p + 1;
        state = 0;
      }
    } else if (c !== 32 && c !== 9) {
      if (state === 2)
        TomlError.x("invalid escape: only line-ending whitespace may be escaped", ctx, sliceStart);
      state = !isLiteral && c === 92 ? 1 : 0;
      sliceStart = ctx.p;
    }
  }
  TomlError.x("unfinished string", ctx, startPtr);
}

// node_modules/smol-toml/dist/date.js
var DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})?[Tt ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|z|[-+]\d{2}:\d{2})?$/i;
var TomlDate = class _TomlDate extends Date {
  #hasDate = false;
  #hasTime = false;
  #offset = null;
  constructor(date, fasttype, unsafeDelim) {
    let hasDate = true;
    let hasTime = true;
    let offset = "Z";
    let c;
    if (typeof date === "string") {
      if (fasttype)
        prep: {
          if (fasttype < 3) {
            if (+date.slice(11, 13) > 23) {
              date = "";
              break prep;
            }
            if (fasttype === 2) {
              offset = null;
              date += "Z";
            } else if ((c = date.charCodeAt(date.length - 1)) !== 90 && c !== 122) {
              offset = date.slice(date.length - 6);
            }
            if (unsafeDelim)
              date = date.slice(0, 10) + "T" + date.slice(11);
          } else if (fasttype === 4) {
            date = +date.slice(0, 2) > 23 ? "" : `0000-01-01T${date}Z`;
          }
          hasDate = fasttype !== 4;
          hasTime = fasttype !== 3;
        }
      else {
        let match = date.match(DATE_TIME_RE);
        if (match) {
          if (!match[1]) {
            hasDate = false;
            date = `0000-01-01T${date}`;
          }
          hasTime = !!match[2];
          hasTime && date[10] === " " && (date = date.replace(" ", "T"));
          if (match[2] && +match[2] > 23) {
            date = "";
          } else {
            offset = match[3] || null;
            if (!offset && hasTime)
              date += "Z";
          }
        } else {
          date = "";
        }
      }
    }
    super(date);
    if (!isNaN(this.getTime())) {
      this.#hasDate = hasDate;
      this.#hasTime = hasTime;
      this.#offset = offset;
    }
  }
  isDateTime() {
    return this.#hasDate && this.#hasTime;
  }
  isLocal() {
    return !this.#hasDate || !this.#hasTime || !this.#offset;
  }
  isDate() {
    return this.#hasDate && !this.#hasTime;
  }
  isTime() {
    return this.#hasTime && !this.#hasDate;
  }
  isValid() {
    return this.#hasDate || this.#hasTime;
  }
  toISOString() {
    let iso = super.toISOString();
    if (this.isDate())
      return iso.slice(0, 10);
    if (this.isTime())
      return iso.slice(11, 23);
    if (this.#offset === null)
      return iso.slice(0, -1);
    if (this.#offset === "Z" || this.#offset === "z")
      return iso;
    let offset = +this.#offset.slice(1, 3) * 60 + +this.#offset.slice(4, 6);
    offset = this.#offset[0] === "-" ? offset : -offset;
    let offsetDate = new Date(this.getTime() - offset * 6e4);
    return offsetDate.toISOString().slice(0, -1) + this.#offset;
  }
  static wrapAsOffsetDateTime(jsDate, offset = "Z") {
    let date = new _TomlDate(jsDate);
    date.#offset = offset;
    return date;
  }
  static wrapAsLocalDateTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#offset = null;
    return date;
  }
  static wrapAsLocalDate(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasTime = false;
    date.#offset = null;
    return date;
  }
  static wrapAsLocalTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasDate = false;
    date.#offset = null;
    return date;
  }
};

// node_modules/smol-toml/dist/extract.js
function isDigit2(char, base = 10) {
  return base === 16 ? char > 47 && char < 58 || char > 64 && char < 71 || char > 96 && char < 103 : char > 47 && char < 48 + base;
}
function isEndOfValue(char, delim) {
  return char === 32 || char === 9 || char === 10 || char === 13 || // Structure end or next value delimiter
  delim && (char === delim || char === 44) || // Comment
  char === 35;
}
function extractValue(ctx, end) {
  let errPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p);
  if (c === 91 || c === 123) {
    ctx.d-- || TomlError.x("document contains excessively nested structures. aborting.", ctx);
    let value = c === 91 ? parseArray(ctx) : parseInlineTable(ctx);
    ctx.d++;
    return value;
  }
  if (c === 34 || c === 39) {
    return parseString(ctx);
  }
  if (c === 116) {
    if (ctx.s.charCodeAt(++ctx.p) !== 114 || ctx.s.charCodeAt(++ctx.p) !== 117 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, true;
  }
  if (c === 102) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 108 || ctx.s.charCodeAt(++ctx.p) !== 115 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, false;
  }
  if (c === 43 || c === 45) {
    return parseNumber(ctx, ctx.p, ctx.s.charCodeAt(++ctx.p), 44 - c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 4) === 45 && ctx.s.charCodeAt(ctx.p + 7) === 45) {
    return parseDate(ctx, c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 2) === 58) {
    return parseTime(ctx, c, end);
  }
  return parseNumber(ctx, ctx.p, c, 0, end);
}
function parseNumber(ctx, startPtr, startChr, sign, endChr) {
  let c = startChr;
  let state = 0;
  let hasUnderscores = false;
  if (c === 105) {
    if (ctx.s.charCodeAt(++ctx.p) !== 110 || ctx.s.charCodeAt(++ctx.p) !== 102)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, (sign || 1) / 0;
  }
  if (c === 110) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 110)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, NaN;
  }
  if (c === 48) {
    if (++ctx.p >= ctx.s.length || isEndOfValue(c = ctx.s.charCodeAt(ctx.p), endChr))
      return ctx.bi === true ? 0n : 0;
    if (!sign) {
      if (c === 120)
        return parseIntegerBaseN(ctx, startPtr, 16, endChr);
      else if (c === 98)
        return parseIntegerBaseN(ctx, startPtr, 2, endChr);
      else if (c === 111)
        return parseIntegerBaseN(ctx, startPtr, 8, endChr);
    }
    if (c === 46)
      state = 2;
    else if (c === 101 || c === 69)
      state = 4;
    else
      TomlError.x("illegal leading zero", ctx, startPtr);
  } else if (!isDigit2(c))
    TomlError.x("invalid value", ctx, startPtr);
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (!state)
      state = 1;
    if (c === 95) {
      if (!(state & 1))
        TomlError.x("illegal underscore", ctx);
      state += 11;
      hasUnderscores = true;
    } else if (state === 1 && c === 46)
      state = 2;
    else if ((state === 1 || state === 3) && (c === 101 || c === 69))
      state = 4;
    else if (state === 4 && (c === 43 || c === 45)) {
      state = 6;
    } else if (!isDigit2(c))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (state > 9)
      state -= 11;
    else if (!(state & 1))
      state++;
  }
  if (!state) {
    let val = (startChr - 48) * (sign || 1);
    return ctx.bi === true ? BigInt(val) : val;
  }
  if (!(state & 1))
    TomlError.x("unfinished numeric value", ctx, startPtr);
  let str = ctx.s.slice(startPtr, ctx.p);
  if (hasUnderscores)
    str = str.replaceAll("_", "");
  return state > 1 ? parseFloat(str) : parseInteger(ctx, str, 10, startPtr);
}
function parseIntegerBaseN(ctx, startPtr, base, endChr) {
  let c, underscore = 1;
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (c === 95) {
      if (underscore & 1)
        TomlError.x("illegal underscore", ctx);
      underscore = 3;
    } else if (!isDigit2(c, base))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (underscore & 1)
      underscore--;
  }
  if (underscore & 1)
    TomlError.x("unfinished numeric value", ctx);
  let str = ctx.s.slice(startPtr + 2, ctx.p);
  if (underscore)
    str = str.replaceAll("_", "");
  return parseInteger(ctx, str, base, startPtr);
}
function parseInteger(ctx, str, base, startPtr) {
  if (ctx.bi !== true)
    int: {
      let val = parseInt(str, base);
      if (!Number.isSafeInteger(val)) {
        if (ctx.bi)
          break int;
        TomlError.x("integer value cannot be represented losslessly", ctx, startPtr);
      }
      return val;
    }
  return base === 10 ? BigInt(str) : BigInt((base === 2 ? "0b" : base === 8 ? "0o" : "0x") + str);
}
function parseDate(ctx, c, endChr) {
  let startPtr = ctx.p++, unsafeSeparator;
  if (!isDigit2(c) || !isDigit2(ctx.s.charCodeAt(ctx.p++)) || !isDigit2(ctx.s.charCodeAt(ctx.p++)) || !isDigit2(ctx.s.charCodeAt(ctx.p++))) {
    return parseNumber(ctx, ctx.p = startPtr, c, 0, endChr);
  }
  ctx.p += 5;
  if (!isDigit2(ctx.s.charCodeAt(ctx.p++)))
    TomlError.x("invalid date-time: date part is malformed", ctx, startPtr);
  if (ctx.p >= ctx.s.length || ((c = ctx.s.charCodeAt(ctx.p)) !== 32 || (unsafeSeparator = true, !isDigit2(ctx.s.charCodeAt(ctx.p + 1)))) && c !== 84 && c !== 116) {
    let t2 = ctx.s.slice(startPtr, ctx.p);
    return readDate(ctx, t2, 3, false, startPtr);
  }
  if (ctx.s.charCodeAt(ctx.p += 3) !== 58)
    TomlError.x("invalid date-time: time part is malformed", ctx, startPtr);
  if (ctx.s.charCodeAt(ctx.p += 3) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit2(ctx.s.charCodeAt(++ctx.p)))
      ;
  if (c = ctx.s.charCodeAt(ctx.p)) {
    if (c === 90 || c === 122) {
      let t2 = ctx.s.slice(startPtr, ++ctx.p);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, "[+00:00]");
    }
    if (c === 43 || c === 45) {
      let t2 = ctx.s.slice(startPtr, ctx.p += 6);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, !ctx.ld && "[" + ctx.s.slice(ctx.p - 6, ctx.p) + "]");
    }
  }
  let t = ctx.s.slice(startPtr, ctx.p);
  return readDate(ctx, t, 2, unsafeSeparator, startPtr);
}
function parseTime(ctx, c, endChr) {
  let start = ctx.p;
  if (!isDigit2(c) || !isDigit2(ctx.s.charCodeAt(++ctx.p))) {
    return parseNumber(ctx, --ctx.p, c, 0, endChr);
  }
  if (ctx.s.charCodeAt(ctx.p += 4) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit2(ctx.s.charCodeAt(++ctx.p)))
      ;
  let t = ctx.s.slice(start, ctx.p);
  return readDate(ctx, t, 4, false, start);
}
function readDate(ctx, str, type, unsafeDelim, errPtr, temporalSuffix) {
  if (ctx.ld) {
    let date = new TomlDate(str, type, unsafeDelim);
    if (!date.isValid())
      TomlError.x("invalid date", ctx, errPtr);
    return date;
  }
  try {
    if (temporalSuffix)
      str += temporalSuffix;
    switch (type) {
      case 1:
        return Temporal.ZonedDateTime.from(str);
      case 2:
        return Temporal.PlainDateTime.from(str);
      case 3:
        return Temporal.PlainDate.from(str);
      case 4:
        return Temporal.PlainTime.from(str);
    }
  } catch (e) {
    TomlError.x(e instanceof Error ? e.message : "" + e, ctx, errPtr);
  }
}

// node_modules/smol-toml/dist/util.js
function skipComment(ctx) {
  for (; ctx.p < ctx.s.length; ctx.p++) {
    let c = ctx.s.charCodeAt(ctx.p);
    if (c === 10)
      break;
    if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10) {
      ctx.p++;
      break;
    }
    if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in comments", ctx);
    }
  }
}
function skipVoid(ctx, banNewLines, banComments) {
  let c;
  while (ctx.p < ctx.s.length) {
    while (ctx.p < ctx.s.length && ((c = ctx.s.charCodeAt(ctx.p)) === 32 || c === 9 || !banNewLines && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)))
      ctx.p++;
    if (banComments || c !== 35)
      break;
    skipComment(ctx);
  }
}

// node_modules/smol-toml/dist/struct.js
function parseKey(ctx, end = 61) {
  let startPtr;
  let state = 0;
  let parsed = [];
  let sliceStart;
  let c = ctx.s.charCodeAt(startPtr = ctx.p);
  do {
    if (c === end) {
      if (!state)
        TomlError.x("unexpected end of key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      return ctx.p++, parsed;
    } else if (c === 46) {
      if (!state)
        TomlError.x("illegal empty bare key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      state = 0;
    } else if (!state && (c === 34 || c === 39)) {
      if (c === ctx.s.charCodeAt(ctx.p + 1) && c === ctx.s.charCodeAt(ctx.p + 2))
        TomlError.x("illegal quoted key: multiline strings are not allowed", ctx);
      parsed.push(parseString(ctx));
      state = 2;
      ctx.p--;
    } else if (c === 32 || c === 9) {
      if (state === 1) {
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
        state = 2;
      }
    } else if (state === 2 || c < 48 && c !== 45 || c > 57 && c < 65 || c > 90 && c < 97 && c !== 95 || c > 122) {
      TomlError.x("illegal character in key", ctx);
    } else if (!state) {
      state = 1;
      sliceStart = ctx.p;
    }
  } while (c = ctx.s.charCodeAt(++ctx.p));
  TomlError.x("incomplete key-value: cannot find end of key", ctx, startPtr);
}
function parseInlineTable(ctx) {
  let startPtr = ctx.p++;
  let res = /* @__PURE__ */ Object.create(null);
  let seen = /* @__PURE__ */ new Set();
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 125) {
      ctx.p++;
      return res;
    }
    let k;
    let t = res;
    let hasOwn = false;
    let errPtr = ctx.p;
    let key = parseKey(ctx);
    for (let i = 0; i < key.length; i++) {
      if (i)
        t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      k = key[i];
      if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== "object" || seen.has(t[k]))) {
        TomlError.x("trying to redefine an already defined value", ctx, errPtr);
      }
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor")) {
        t = ctx.uk !== 1 && TomlError.x("document contains an unsafe property", ctx, errPtr);
        break;
      }
      if (!hasOwn && unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
      }
    }
    if (hasOwn) {
      TomlError.x("trying to redefine an already defined value", ctx, errPtr);
    }
    skipVoid(ctx, true, true);
    let value = extractValue(
      ctx,
      125
      /* } */
    );
    if (t && typeof (t[k] = value) === "object")
      seen.add(value);
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 125) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished table", ctx, startPtr);
}
function parseArray(ctx) {
  let startPtr = ctx.p++;
  let res = [];
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 93) {
      ctx.p++;
      return res;
    }
    res.push(extractValue(
      ctx,
      93
      /* ] */
    ));
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 93) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished array", ctx, startPtr);
}

// node_modules/smol-toml/dist/parse.js
function peekTable(ctx, key, table, meta, type) {
  let t = table;
  let m = meta;
  let k;
  let hasOwn = false;
  let state;
  for (let i = 0; i < key.length; i++) {
    if (i) {
      t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      m = (state = m[k]).c;
      if (type === 0 && (state.t === 1 || state.t === 2)) {
        return null;
      }
      if (state.t === 2) {
        let l = t.length - 1;
        t = t[l];
        m = m[l].c;
      }
    }
    k = key[i];
    if ((hasOwn = Object.hasOwn(t, k)) && m[k]?.t === 0 && m[k]?.d) {
      return null;
    }
    if (!hasOwn) {
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor"))
        return false;
      if (unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
        Object.defineProperty(m, k, { enumerable: true, configurable: true, writable: true });
      }
      m[k] = {
        t: i < key.length - 1 && type === 2 ? 3 : type,
        d: false,
        i: 0,
        c: /* @__PURE__ */ Object.create(null)
      };
    }
  }
  state = m[k];
  if (state.t !== type && !(type === 1 && state.t === 3)) {
    return null;
  }
  if (type === 2) {
    if (!state.d) {
      state.d = true;
      t[k] = [];
    }
    t[k].push(t = /* @__PURE__ */ Object.create(null));
    state.c[state.i++] = state = { t: 1, d: false, i: 0, c: /* @__PURE__ */ Object.create(null) };
  }
  if (state.d) {
    return null;
  }
  state.d = true;
  if (type === 1) {
    t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
  } else if (type === 0 && hasOwn) {
    return null;
  }
  return [k, t, state.c];
}
function validateTablePeek(ctx, peek, ptr) {
  if (peek === null || ctx.uk === 2)
    TomlError.x(peek === null ? "trying to redefine an already defined table or value" : "document contains an unsafe property", ctx, ptr);
}
function parse3(toml, options = {}) {
  let ctx = {
    s: toml,
    p: 0,
    d: options.maxDepth ?? 1e3,
    bi: options.integersAsBigInt ?? false,
    ld: options.useLegacyDate ?? true,
    uk: options.unsafeKeyBehaviour === "throw" ? 2 : options.unsafeKeyBehaviour === "drop" ? 1 : 0
  };
  let res = /* @__PURE__ */ Object.create(null);
  let meta = /* @__PURE__ */ Object.create(null);
  let tmp;
  let skipping = false;
  let tbl = res;
  let m = meta;
  if (toml.charCodeAt(0) === 65279)
    ctx.p++;
  skipVoid(ctx);
  while (ctx.p < toml.length) {
    if (toml.charCodeAt(ctx.p) === 91) {
      let isTableArray = toml.charCodeAt(++ctx.p) === 91;
      tmp = ctx.p += +isTableArray;
      skipping = false;
      let k = parseKey(
        ctx,
        93
        /* ] */
      );
      if (isTableArray) {
        if (toml.charCodeAt(ctx.p) !== 93) {
          TomlError.x("expected end of table array declaration", ctx);
        }
        ctx.p++;
      }
      let p = peekTable(
        ctx,
        k,
        res,
        meta,
        isTableArray ? 2 : 1
        /* Type.EXPLICIT */
      );
      if (!p) {
        validateTablePeek(ctx, p, tmp);
        skipping = true;
      } else {
        m = p[2];
        tbl = p[1];
      }
    } else {
      tmp = ctx.p;
      let k = parseKey(ctx);
      let p = peekTable(
        ctx,
        k,
        tbl,
        m,
        0
        /* Type.DOTTED */
      );
      if (!p && !skipping)
        validateTablePeek(ctx, p, tmp);
      skipVoid(ctx, true, true);
      let v = extractValue(ctx, void 0);
      if (p && !skipping)
        p[1][p[0]] = v;
    }
    skipVoid(ctx, true);
    if (ctx.p < toml.length && (tmp = toml.charCodeAt(ctx.p)) !== 10 && (tmp !== 13 || toml.charCodeAt(ctx.p + 1) !== 10)) {
      TomlError.x("each key-value declaration must be followed by an end-of-line", ctx);
    }
    skipVoid(ctx);
  }
  return res;
}

// node_modules/smol-toml/dist/stringify.js
var HAS_WELLFORMED = !!"".isWellFormed;

// src/shared/errors.js
var STATUS = {
  REQUEST_INVALID: 400,
  BODY_TOO_LARGE: 413,
  FIELD_UNSUPPORTED: 400,
  UNSUPPORTED_ACTION: 400,
  CONFIG_INVALID: 422,
  HIDDEN_VALUE_CHANGED: 422,
  WRITE_REJECTED: 422,
  NAME_TAKEN: 409,
  NAME_CLEANING: 409,
  REVISION_CONFLICT: 409,
  NOT_WRITABLE: 403,
  INHERITED_ROW: 403,
  CANDIDATE_STALE: 410,
  ROW_NOT_FOUND: 404,
  SERVICE_CLOSED: 503,
  SERVICE_UNAVAILABLE: 503,
  CATALOG_UNAVAILABLE: 502,
  CATALOG_INVALID: 502
};
var HubError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HubError";
    this.code = code;
    this.status = STATUS[code] ?? 500;
  }
};
function fail(code, message) {
  throw new HubError(code, message);
}

// src/shared/mcp-config.js
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var own = (value, key) => object(value) && Object.hasOwn(value, key);
var DEFAULT_MAX_CONFIG_BYTES = 2 * 1024 * 1024;
var UNPARSED = "\u65E0\u6CD5\u89E3\u6790\u6B64\u670D\u52A1\u5668\u914D\u7F6E";
function parseDocument(text, path, options = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_CONFIG_BYTES;
  if (new TextEncoder().encode(text).length > maxBytes) fail("BODY_TOO_LARGE", `\u914D\u7F6E\u6587\u4EF6\u8D85\u8FC7 ${Math.floor(maxBytes / 1024)} KB\uFF0C\u8BF7\u9009\u62E9\u8F83\u5C0F\u7684\u914D\u7F6E\u6587\u4EF6`);
  if (typeof path === "string" && path.endsWith(".toml")) {
    const result2 = parse3(text);
    if (!object(result2)) fail("CONFIG_INVALID", "\u914D\u7F6E\u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684 TOML \u5BF9\u8C61");
    return result2;
  }
  const errors = [];
  const result = parse2(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length || !object(result)) fail("CONFIG_INVALID", "\u914D\u7F6E\u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684 JSON / JSONC \u5BF9\u8C61");
  return result;
}
var COMMON_FIELDS = ["transport", "type", "enabled", "disabled", "startup_timeout_sec", "tool_timeout_sec", "startupTimeoutMs", "toolCallTimeoutMs", "closeTimeoutMs", "reconnect"];
var STDIO_FIELDS = ["command", "args", "env", "environment", "env_vars", "cwd"];
var HTTP_FIELDS = ["url", "httpUrl", "serverUrl", "headers", "http_headers", "env_http_headers", "bearer_token_env_var"];
var isEmptyValue = (value) => value === void 0 || value === null || value === "" || object(value) && Object.keys(value).length === 0;
function normalize(name, raw) {
  if (!object(raw)) fail("CONFIG_INVALID", "\u670D\u52A1\u5668\u914D\u7F6E\u5FC5\u987B\u662F\u5BF9\u8C61");
  const issues = [];
  const entry = { enabled: raw.enabled !== false && raw.disabled !== true };
  const remoteUrl = raw.url ?? raw.httpUrl ?? raw.serverUrl;
  const transport = raw.transport ?? raw.type ?? (remoteUrl ? "streamable-http" : "stdio");
  if (["local", "stdio"].includes(transport)) {
    entry.transport = "stdio";
    entry.command = Array.isArray(raw.command) ? raw.command[0] : raw.command;
    entry.args = Array.isArray(raw.command) ? raw.command.slice(1) : raw.args ?? [];
    const forwarded = Array.isArray(raw.env_vars) ? raw.env_vars.filter((name2) => typeof name2 === "string" && name2) : [];
    if (raw.env_vars !== void 0 && (!Array.isArray(raw.env_vars) || forwarded.length !== raw.env_vars.length)) issues.push("\u9700\u8981\u5904\u7406\u672A\u8FC1\u79FB\u5B57\u6BB5\uFF1Aenv_vars");
    const forwardedEnv = Object.fromEntries(forwarded.map((name2) => [name2, "${env:" + name2 + "}"]));
    const explicitEnv = raw.env ?? raw.environment;
    entry.env = explicitEnv === void 0 || object(explicitEnv) ? { ...forwardedEnv, ...explicitEnv ?? {} } : explicitEnv;
    if (raw.cwd) entry.cwd = raw.cwd;
  } else if (["remote", "http", "streamable-http"].includes(transport)) {
    entry.transport = "streamable-http";
    entry.url = remoteUrl;
    entry.headers = raw.headers ?? (raw.http_headers || {});
    if (raw.env_http_headers) {
      entry.headers = { ...entry.headers, ...Object.fromEntries(Object.entries(raw.env_http_headers).map(([k, v]) => [k, "${env:" + v + "}"])) };
    }
    if (raw.bearer_token_env_var) entry.headers = { ...entry.headers, Authorization: "Bearer ${env:" + raw.bearer_token_env_var + "}" };
  } else {
    entry.transport = transport;
    issues.push("\u6682\u4E0D\u652F\u6301\u6B64\u4F20\u8F93\u65B9\u5F0F\uFF1A" + transport);
  }
  const ownFields = entry.transport === "stdio" ? STDIO_FIELDS : HTTP_FIELDS;
  const foreign = entry.transport === "stdio" ? HTTP_FIELDS : STDIO_FIELDS;
  const known = /* @__PURE__ */ new Set([...COMMON_FIELDS, ...ownFields]);
  const unknown = Object.keys(raw).filter((key) => !known.has(key) && !foreign.includes(key));
  const incompatible = Object.keys(raw).filter((key) => foreign.includes(key) && !isEmptyValue(raw[key]));
  if (incompatible.length) issues.push("\u4E0E\u5F53\u524D\u8FDE\u63A5\u65B9\u5F0F\u4E0D\u517C\u5BB9\uFF08\u672A\u8FC1\u79FB\uFF09\uFF1A" + incompatible.join("\u3001"));
  if (unknown.length) issues.push("\u9700\u8981\u5904\u7406\u672A\u8FC1\u79FB\u5B57\u6BB5\uFF1A" + unknown.join("\u3001"));
  if (raw.startup_timeout_sec !== void 0) entry.startupTimeoutMs = raw.startup_timeout_sec * 1e3;
  if (raw.tool_timeout_sec !== void 0) entry.toolCallTimeoutMs = raw.tool_timeout_sec * 1e3;
  for (const field of ["startupTimeoutMs", "toolCallTimeoutMs", "closeTimeoutMs", "reconnect"]) if (raw[field] !== void 0) entry[field] = raw[field];
  assertEntryShape(entry);
  return { name, entry, issues };
}
function assertEntryShape(entry) {
  if (!object(entry)) fail("CONFIG_INVALID", "\u914D\u7F6E\u5FC5\u987B\u662F\u5BF9\u8C61");
  for (const field of ["command", "cwd", "url", "transport"]) if (entry[field] !== void 0 && typeof entry[field] !== "string") fail("CONFIG_INVALID", "\u914D\u7F6E\u5B57\u6BB5 " + field + " \u5FC5\u987B\u662F\u5B57\u7B26\u4E32");
  if (entry.args !== void 0 && (!Array.isArray(entry.args) || entry.args.some((value) => typeof value !== "string"))) fail("CONFIG_INVALID", "\u914D\u7F6E\u5B57\u6BB5 args \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4");
  for (const field of ["env", "headers"]) if (entry[field] !== void 0 && (!object(entry[field]) || Object.values(entry[field]).some((value) => typeof value !== "string"))) fail("CONFIG_INVALID", "\u914D\u7F6E\u5B57\u6BB5 " + field + " \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u952E\u503C\u5BF9\u8C61");
}
function containerOf(document2) {
  if (!object(document2)) fail("CONFIG_INVALID", "JSON \u914D\u7F6E\u5FC5\u987B\u662F\u5BF9\u8C61");
  const present = (key) => own(document2, key) && document2[key] !== null ? document2[key] : void 0;
  for (const key of ["mcp_servers", "mcpServers", "servers"]) {
    const value = present(key);
    if (value !== void 0) return { container: value, prefix: [key] };
  }
  if (object(document2.mcp) && document2.mcp.servers !== null && document2.mcp.servers !== void 0) {
    return { container: document2.mcp.servers, prefix: ["mcp", "servers"] };
  }
  if (present("mcp") !== void 0) return { container: document2.mcp, prefix: ["mcp"] };
  const flat = Object.values(document2).some((value) => object(value) && ("command" in value || "url" in value));
  return { container: flat ? document2 : {}, prefix: [] };
}
function extract(document2) {
  const { container, prefix } = containerOf(document2);
  if (Array.isArray(container) && !container.length) return [];
  if (!object(container)) fail("CONFIG_INVALID", "\u672A\u627E\u5230\u6709\u6548\u7684 MCP \u914D\u7F6E\u5217\u8868");
  return Object.entries(container).map(([name, raw]) => {
    const path = [...prefix, name];
    try {
      const normalized = normalize(name, raw);
      return { ...normalized, raw, path };
    } catch (error) {
      return { name, entry: {}, raw, path, invalid: true, issues: [UNPARSED + (error?.message ? "\uFF1A" + error.message : "")] };
    }
  });
}
function parseEditorDocument(text, fallbackName = "", filename = "paste.jsonc", options = {}) {
  return parseEditorObject(parseDocument(text, filename, options), fallbackName);
}
function parseEditorObject(document2, fallbackName = "") {
  if (!object(document2)) fail("CONFIG_INVALID", "JSON \u914D\u7F6E\u5FC5\u987B\u662F\u5BF9\u8C61");
  const direct = ["command", "url", "transport", "type"].some((key) => Object.hasOwn(document2, key));
  let rows;
  if (direct) {
    const { name, serverName, ...raw } = document2;
    const rowName = serverName ?? name ?? fallbackName;
    try {
      const normalized = normalize(rowName, raw);
      rows = [{ ...normalized, raw, path: [], direct: true }];
    } catch (error) {
      rows = [{ name: rowName, entry: {}, raw, path: [], direct: true, invalid: true, issues: [UNPARSED + (error?.message ? "\uFF1A" + error.message : "")] }];
    }
  } else rows = extract(document2);
  if (!rows.length) fail("CONFIG_INVALID", "\u672A\u627E\u5230 MCP \u670D\u52A1\u3002\u652F\u6301\u5355\u4E2A\u914D\u7F6E\u3001{\u670D\u52A1\u540D: \u914D\u7F6E} \u6216 mcpServers \u683C\u5F0F");
  return rows;
}

// src/shared/display.js
var SECRET_WORDS = /* @__PURE__ */ new Set(["token", "tokens", "secret", "secrets", "passwd", "password", "pwd", "apikey", "key", "keys", "auth", "authorization", "credential", "credentials", "private", "cookie", "session", "signature", "salt", "dsn", "bearer"]);
var SECRET_PARTS = ["password", "passwd", "secret", "token", "apikey", "credential", "authorization", "bearer", "cookie", "signature"];
function isSecretKey(key) {
  const lower = String(key).toLowerCase();
  if (lower.split(/[^a-z0-9]+/).some((part) => SECRET_WORDS.has(part))) return true;
  return SECRET_PARTS.some((part) => lower.includes(part));
}

// src/shared/servers.js
function takenNames(servers) {
  return (servers ?? []).filter((row) => row && row.name && row.managed !== "cleanup").map((row) => row.name);
}
var defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function retryWhileCleaning(run, { attempts = 6, delayMs = 350, sleep: sleep2 = defaultSleep } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run(attempt);
    } catch (error) {
      if (error?.code !== "NAME_CLEANING" || attempt >= attempts) throw error;
      await sleep2(delayMs);
    }
  }
}

// src/client/i18n.js
var import_react = __toESM(require("react"), 1);
var EN = {
  // Navigation and chrome
  "MCP Hub \u9875\u9762": "MCP Hub pages",
  "\u6DFB\u52A0 MCP": "Add MCP",
  "\u8FDE\u63A5\u3001\u7BA1\u7406\u4F60\u7684 MCP \u670D\u52A1\uFF0C\u628A\u5E38\u7528\u5DE5\u5177\u5E26\u5230 DSH\u3002": "Connect and manage your MCP services, and bring their tools into DSH.",
  "\u5DF2\u6DFB\u52A0": "Added",
  "\u5DF2\u6DFB\u52A0 ": "Added ",
  " \u4E2A\u5DE5\u5177": " tools",
  "\u624B\u52A8\u6DFB\u52A0": "Manual",
  "\u672C\u5730\u5BFC\u5165": "Local import",
  "\u5728\u7EBF\u641C\u7D22": "Search",
  "\u6DFB\u52A0 MCP \u670D\u52A1": "Add MCP service",
  "\u7F16\u8F91 MCP \u670D\u52A1": "Edit MCP service",
  "\u5173\u95ED\u914D\u7F6E\u7A97\u53E3": "Close configuration window",
  "\u6253\u5F00 GitHub \u9879\u76EE": "Open the GitHub project",
  "\u5173\u95ED\u901A\u77E5": "Dismiss notification",
  "\u670D\u52A1": "Service",
  "\u7BA1\u7406": "Manage",
  "\u4E2A MCP \u670D\u52A1": " MCP services",
  "\u4E2A\u5DE5\u5177": " tools",
  "\u5DF2\u8FDE\u63A5": "Connected",
  "\u5DF2\u505C\u7528": "Disabled",
  "\u8FDE\u63A5\u4E2D": "Connecting",
  "\u91CD\u8FDE\u4E2D": "Reconnecting",
  "\u7F3A\u5C11\u51ED\u8BC1": "Missing credentials",
  "\u7F3A\u5C11 DSH \u51ED\u8BC1": "Missing DSH credentials",
  "\u6B63\u5728\u542F\u52A8\uFF1A\u9996\u6B21\u8FD0\u884C\u53EF\u80FD\u9700\u8981\u4E0B\u8F7D\u4F9D\u8D56\u6216\u7B49\u5F85\u7F51\u7EDC\uFF0C\u8BF7\u7A0D\u5019": "Starting: the first run may need to download dependencies or wait for the network.",
  "\u6E05\u7406\u672A\u5B8C\u6210\uFF1A": "Cleanup did not finish: ",
  "\uFF1B\u91CD\u542F DSH \u540E\u4F1A\u6E05\u9664": ". It clears after DSH restarts.",
  "\u8FDE\u63A5\u5931\u8D25": "Connection failed",
  "\u672A\u8FDE\u63A5": "Not connected",
  "\u9700\u8981\u5904\u7406": "Needs attention",
  "\u91CD\u8FDE\u5F02\u5E38\u9879": "Reconnect failed items",
  "\u5168\u90E8\u72B6\u6001": "All statuses",
  "\u7B5B\u9009\u8FDE\u63A5\u72B6\u6001": "Filter by connection status",
  "\u641C\u7D22\u5DF2\u6DFB\u52A0\u7684 MCP": "Search added MCP",
  "\u641C\u7D22\u670D\u52A1\u540D\u79F0\u6216\u6765\u6E90\u2026": "Search service name or source\u2026",
  "\u641C\u7D22 MCP \u540D\u79F0\u6216\u6765\u6E90\u2026": "Search MCP name or source\u2026",
  "\u641C\u7D22\u672C\u5730 MCP": "Search local MCP",
  "\u641C\u7D22\u5DE5\u5177\u2026": "Search tools\u2026",
  "\u641C\u7D22": "Search",
  "\u641C\u7D22\u4E2D\u2026": "Searching\u2026",
  "\u626B\u63CF\u4E2D\u2026": "Scanning\u2026",
  "\u91CD\u65B0\u626B\u63CF": "Scan again",
  "\u6B63\u5728\u8BFB\u53D6\u670D\u52A1\u2026": "Loading services\u2026",
  "\u8FDE\u63A5\u4F60\u7684\u7B2C\u4E00\u4E2A MCP": "Connect your first MCP",
  "\u6CA1\u6709\u5339\u914D\u7684\u670D\u52A1": "No matching services",
  "\u8BD5\u8BD5\u5176\u4ED6\u540D\u79F0\u6216\u6765\u6E90\u3002": "Try another name or source.",
  "\u8BD5\u8BD5\u5176\u4ED6\u540D\u79F0\u6216\u5207\u6362\u72B6\u6001\u7B5B\u9009\u3002": "Try another name or change the status filter.",
  "\u624B\u52A8\u6DFB\u52A0\u670D\u52A1\uFF0C\u6216\u4ECE\u5176\u4ED6 AI \u5E94\u7528\u5BFC\u5165\u5DF2\u6709\u914D\u7F6E\u3002": "Add a service manually, or import an existing configuration from another AI app.",
  "\u4ECE\u672C\u673A\u5BFC\u5165": "Import from this computer",
  "\u672A\u53D1\u73B0\u53EF\u5BFC\u5165\u7684 MCP": "No importable MCP configurations found",
  "\u53EF\u4EE5\u9009\u62E9\u914D\u7F6E\u6587\u4EF6\uFF0C\u6216\u5728\u5176\u4ED6\u5E94\u7528\u914D\u7F6E MCP \u540E\u91CD\u65B0\u626B\u63CF\u3002": "Choose a configuration file, or configure MCP in another app and scan again.",
  "\u6B63\u5728\u67E5\u627E\u672C\u673A MCP \u914D\u7F6E\u2026": "Looking for local MCP configurations\u2026",
  "\u5BFC\u5165\u72B6\u6001\u66F4\u65B0\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u626B\u63CF\u540E\u91CD\u8BD5": "Could not update import status. Scan again and retry.",
  "\u4ECE\u5176\u4ED6\u5E94\u7528\u5BFC\u5165\u5DF2\u6709 MCP": "Import existing MCP from another app",
  "\u9009\u62E9\u914D\u7F6E\u6587\u4EF6": "Choose configuration file",
  // Shared status / reason copy
  "\u91CD\u8FDE\u9884\u7B97\u5DF2\u8017\u5C3D\uFF0C\u5DE5\u5177\u5DF2\u64A4\u56DE": "Reconnect budget exhausted; tools withdrawn",
  "\u91CD\u8FDE\u5DF2\u5173\u95ED\uFF0C\u8FDE\u63A5\u4E2D\u65AD\u540E\u4E0D\u518D\u6062\u590D": "Reconnect disabled; it will stay offline after a disconnect",
  "\u4E0A\u6B21\u8FDE\u63A5\u672A\u786E\u8BA4\u5173\u95ED\uFF0C\u5DF2\u963B\u6B62\u66FF\u6362": "Previous connection was not confirmed closed; replacement blocked",
  "\u542F\u52A8\u5931\u8D25": "Failed to start",
  "\u6E05\u7406\u672A\u5B8C\u6210\uFF0C\u9700\u8981\u91CD\u542F DSH": "Cleanup incomplete; restart DSH",
  "\u7EE7\u627F\u914D\u7F6E": "Inherited config",
  "\u63D2\u4EF6\u6CE8\u518C": "Plugin registration",
  "\u5DF2\u5220\u9664\uFF0C\u6E05\u7406\u4E2D": "Removed, cleaning up",
  "\u914D\u7F6E\u5F02\u5E38": "Configuration error",
  "\uFF08\u672A\u8BBE\u7F6E\uFF09": "(not set)",
  "\uFF08\u5DF2\u9690\u85CF\uFF09": "(hidden)",
  "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5": "Something went wrong. Try again.",
  "\u65E0\u6CD5\u8FDE\u63A5 MCP Hub\uFF0C\u8BF7\u786E\u8BA4 Host \u63D2\u4EF6\u5DF2\u542F\u7528": "Cannot reach MCP Hub. Make sure the Host plugin is enabled.",
  "\u8FD9\u4E2A\u9762\u677F\u51FA\u9519\u4E86\uFF1A": "This panel crashed: ",
  "\u672A\u77E5\u9519\u8BEF": "Unknown error",
  "\u91CD\u8BD5": "Retry",
  "\u6B63\u5728\u9A8C\u8BC1\u8FDE\u63A5\u2026": "Verifying connection\u2026",
  "\u4E0A\u6B21\u9A8C\u8BC1\u672A\u901A\u8FC7\uFF1A": "Last verification failed: ",
  "\u8FDE\u63A5\u9A8C\u8BC1\u672A\u901A\u8FC7": "Connection verification failed",
  "\u7B2C ": "Attempt ",
  " \u6B21\u91CD\u8BD5": "",
  "MCP \u8FDE\u63A5": "MCP connection",
  "MCP \u8FDE\u63A5\u6D4B\u8BD5": "MCP connection test",
  "\u5DE5\u5177\u53D1\u73B0": "Tool discovery",
  "\u6D4B\u8BD5\u8FDE\u63A5\u5DF2\u5173\u95ED": "Test connection closed",
  "\u8FDE\u63A5\u6E05\u7406": "Connection cleanup",
  "\u672A\u786E\u8BA4\u5173\u95ED": "Not confirmed closed",
  "\u6E05\u7406\u9519\u8BEF": "Cleanup error",
  "\u505C\u6B62\u539F\u56E0": "Stop reason",
  "\u91CD\u8BD5\u6B21\u6570": "Retry count",
  "\u4E0B\u6B21\u91CD\u8BD5": "Next retry",
  "\u6700\u8FD1\u4E00\u6B21\u9A8C\u8BC1": "Last verification",
  "\u590D\u8BCA": "Re-check",
  "\u73B0\u5728\u590D\u8BCA\uFF08\u4E0D\u5F71\u54CD\u8FD0\u884C\u4E2D\u7684\u5B9E\u4F8B\uFF09": "Re-check now (does not affect the running instance)",
  "\u8FDE\u63A5\u8BCA\u65AD": "Connection diagnostics",
  "\u914D\u7F6E\u5F52\u5C5E": "Configuration owner",
  "\u5BFC\u5165\u6765\u6E90": "Import source",
  "\u5B98\u65B9 MCP Registry": "Official MCP Registry",
  "\u914D\u7F6E\u6587\u4EF6": "Configuration file",
  "\u4ECE ": "Imported from ",
  " \u5BFC\u5165": "",
  "\u914D\u7F6E\u590D\u5236\u5230 DSH \u540E\u72EC\u7ACB\u7BA1\u7406": "The configuration is managed independently in DSH after copying.",
  "\u9879\u76EE\u7EA7\u914D\u7F6E \xB7 ": "Project-level config \xB7 ",
  "\u6765\u6E90\u6587\u4EF6": "Source file",
  "DSH \u5168\u5C40\u914D\u7F6E": "DSH global configuration",
  "\u670D\u52A1\u63D0\u4F9B\u7684\u5DE5\u5177": "Tools provided by this service",
  "\u6B63\u5728\u8BFB\u53D6\u5DE5\u5177\u53C2\u6570\u2026": "Loading tool parameters\u2026",
  "\u670D\u52A1\u8FDE\u63A5\u6210\u529F\u540E\uFF0C\u8FD9\u91CC\u5C06\u663E\u793A\u53EF\u7528\u5DE5\u5177\u3002": "Available tools will appear here after the service connects.",
  "\u5DE5\u5177\u6E05\u5355\u6765\u81EA\u4FDD\u5B58\u540E\u7684\u6B63\u5F0F\u8FDE\u63A5\uFF0C\u4E0D\u6CBF\u7528\u6DFB\u52A0\u9875\u7684\u6D4B\u8BD5\u7ED3\u679C\u3002": "The tool list comes from the real connection after saving, not the test result on the add page.",
  "\u5C55\u5F00\u540E\u52A0\u8F7D\u53C2\u6570 Schema\u3002": "Expand to load the parameter schema.",
  "\u65E0\u63CF\u8FF0": "No description",
  "\u914D\u7F6E": "Configuration",
  "\u5DE5\u5177": "Tools",
  "\u8BCA\u65AD": "Diagnostics",
  "\u51ED\u636E\u6309\u5B57\u6BB5\u540D\u9690\u85CF\uFF1B\u666E\u901A\u73AF\u5883\u53D8\u91CF\u4E0E\u542F\u52A8\u53C2\u6570\u6309\u539F\u503C\u663E\u793A\u3002": "Credentials are hidden by field name; ordinary environment variables and arguments are shown as-is.",
  "\u670D\u52A1\u5DF2\u8FDE\u63A5\uFF0C\u5DE5\u5177\u5DF2\u540C\u6B65\u5230 DSH\u3002": "Connected; tools are synced to DSH.",
  "\u914D\u7F6E\u5DF2\u4FDD\u7559\uFF0C\u542F\u7528\u540E\u5F00\u59CB\u8FDE\u63A5\u3002": "Configuration kept; it will connect when enabled.",
  "\u8BF7\u68C0\u67E5\u8FD0\u884C\u73AF\u5883\u3001\u53D8\u91CF\u548C\u8BA4\u8BC1\u914D\u7F6E\u3002": "Check the runtime environment, variables, and authentication.",
  // Dialogs
  "\u53D6\u6D88": "Cancel",
  "\u5904\u7406\u4E2D\u2026": "Working\u2026",
  "\u5220\u9664 MCP \u670D\u52A1\uFF1F": "Delete MCP service?",
  "\u5220\u9664": "Delete",
  "\u5C06\u4ECE DSH \u79FB\u9664": "This will remove the configuration for ",
  "\u5C06\u4ECE DSH \u79FB\u9664 ": "This will remove the configuration for ",
  " \u7684\u914D\u7F6E\u5E76\u65AD\u5F00\u8FDE\u63A5\u3002": " from DSH and disconnect it.",
  "\u5BFC\u51FA\u914D\u7F6E": "Export configuration",
  "\u9009\u62E9\u662F\u5426\u628A\u5BC6\u94A5\u4E00\u8D77\u5BFC\u51FA\u3002": "Choose whether to include secrets.",
  "\u4E0D\u5305\u542B\u5BC6\u94A5": "Without secrets",
  "\u9002\u5408\u5206\u4EAB\u7ED9\u4ED6\u4EBA\u6216\u505A\u901A\u7528\u5907\u4EFD\u3002\u51ED\u636E\u53EA\u4FDD\u7559 ${credential:\u2026} \u5F15\u7528\uFF0C\u6362\u4E00\u53F0\u673A\u5668\u540E\u9700\u8981\u914D\u7F6E\u540C\u540D\u51ED\u8BC1\u3002": "Good for sharing or general backups. Credentials stay as ${credential:\u2026} references; configure the same names on the other machine after restore.",
  "\u540C\u65F6\u5BFC\u51FA\u5BC6\u94A5": "Include secrets",
  "\u9002\u5408\u8FC1\u79FB\u5230\u81EA\u5DF1\u7684\u53E6\u4E00\u53F0\u7535\u8111\u3002\u5F15\u7528\u4F1A\u89E3\u6790\u4E3A\u5F53\u524D\u503C\u5E76\u4EE5\u660E\u6587\u5199\u5165 JSON\uFF0C\u8BF7\u53EA\u4FDD\u5B58\u5728\u53EF\u4FE1\u4F4D\u7F6E\uFF0C\u4E0D\u8981\u5206\u4EAB\u8FD9\u4EFD\u6587\u4EF6\u3002": "Good for moving to your own machine. References are resolved to their current values and written as plaintext; keep the file somewhere safe and never share it.",
  "\u5BFC\u51FA\u6587\u4EF6\u5C06\u5305\u542B\u660E\u6587\u5BC6\u94A5\u3002\u53D1\u9001\u6216\u4E0A\u4F20\u524D\u8BF7\u786E\u8BA4\u63A5\u6536\u65B9\u53EF\u4FE1\u3002": "The export will contain plaintext secrets. Make sure the recipient is trusted before sending or uploading it.",
  "\u5BFC\u51FA\u4E2D\u2026": "Exporting\u2026",
  "\u5BFC\u51FA\uFF08\u542B\u5BC6\u94A5\uFF09": "Export (with secrets)",
  "\u5BFC\u51FA": "Export",
  "\u5173\u95ED\u8BE6\u60C5": "Close details",
  "\u6B63\u5728\u8BFB\u53D6\u670D\u52A1\u8BE6\u60C5\u2026": "Loading service details\u2026",
  "\u7248\u672C ": "Version ",
  "\u5B98\u7F51": "Website",
  "\u4ED3\u5E93": "Repository",
  "\u5B89\u88C5\u65B9\u5F0F": "Install method",
  "\u6682\u4E0D\u652F\u6301\u81EA\u52A8\u6DFB\u52A0": "Automatic install not supported",
  "\u8FD9\u4E2A\u670D\u52A1\u6CA1\u6709\u53EF\u8F6C\u6362\u4E3A DSH \u914D\u7F6E\u7684\u5305\u6216 HTTP \u5730\u5740\uFF1B\u53EF\u4EE5\u590D\u5236\u4ED3\u5E93\u4E2D\u7684\u914D\u7F6E\u624B\u52A8\u6DFB\u52A0\u3002": "This service has no package or HTTP endpoint that can be converted to DSH configuration. Copy the configuration from its repository and add it manually.",
  "\u5217\u8868\u4E2D\u7684\u300C\u6DFB\u52A0\u300D\u9ED8\u8BA4\u4F7F\u7528\u7B2C\u4E00\u79CD\u65B9\u5F0F\uFF1B\u5176\u4ED6\u65B9\u5F0F\u53EF\u4EE5\u6DFB\u52A0\u540E\u5728\u8868\u5355\u6216 JSON \u4E2D\u8C03\u6574\u3002": "The card's Add button uses the first method; adjust it later in the form or JSON.",
  "\u9ED8\u8BA4\u5C06\u5199\u5165\u7684\u914D\u7F6E": "Configuration that will be written",
  "\u6682\u4E0D\u652F\u6301\u81EA\u52A8\u8F6C\u6362": "Automatic conversion not supported",
  "\u6DFB\u52A0\u4E2D\u2026": "Adding\u2026",
  "\u6DFB\u52A0\u5230 MCP Hub\uFF08\u9ED8\u8BA4\u4F7F\u7528\u7B2C\u4E00\u79CD\u5B89\u88C5\u65B9\u5F0F\uFF09": "Add to MCP Hub (uses the first install method)",
  "\u67E5\u770B\u8BE6\u60C5": "View details",
  "\u6B63\u5728\u8BFB\u53D6\u5B98\u65B9\u76EE\u5F55\u2026": "Loading the official directory\u2026",
  "\u6CA1\u6709\u627E\u5230\u5339\u914D\u7684\u670D\u52A1": "No matching services found",
  "\u6362\u4E2A\u5173\u952E\u8BCD\uFF0C\u6216\u76F4\u63A5\u7C98\u8D34\u914D\u7F6E\u624B\u52A8\u6DFB\u52A0\u3002": "Try another keyword, or paste a configuration manually.",
  "\u6309\u670D\u52A1\u540D\u79F0\u641C\u7D22\u5B98\u65B9 MCP Registry\uFF08\u81F3\u5C11 3 \u4E2A\u5B57\u7B26\uFF09\u2026": "Search the official MCP Registry by name (at least 3 characters)\u2026",
  "\u5B98\u65B9 Registry \u8981\u6C42\u81F3\u5C11\u8F93\u5165 3 \u4E2A\u5B57\u7B26": "The official Registry requires at least 3 characters",
  "\u53EA\u8BFB\u53D6\u5B98\u65B9 MCP Registry \u7684\u516C\u5F00\u76EE\u5F55\uFF1B\u7ED3\u679C\u6309\u5B98\u65B9\u670D\u52A1\u540D\u987A\u5E8F\u8FD4\u56DE\uFF0C\u6CA1\u6709\u70ED\u5EA6\u6216\u4E0B\u8F7D\u91CF\u6392\u5E8F\u3002\u4E0D\u4F1A\u81EA\u52A8\u5B89\u88C5\uFF0C\u6DFB\u52A0\u540E\u4ECD\u9700\u6D4B\u8BD5\u5E76\u4FDD\u5B58\u3002": "Read-only public catalog from the official MCP Registry. Results follow the official service-name order; there is no popularity or download ranking. Nothing is installed automatically; test and save after adding.",
  "\u641C\u7D22\u5B98\u65B9 MCP Registry": "Search the official MCP Registry",
  "\u66F4\u65B0\u4E8E ": "Updated ",
  // Form
  "\u7F16\u8F91\u6A21\u5F0F\u53EA\u4FDD\u5B58\u5F53\u524D\u8FD9\u4E00\u4E2A\u670D\u52A1\uFF1BJSON \u4E0E\u8868\u5355\u5404\u81EA\u4FDD\u7559\u4FEE\u6539\uFF0C\u5207\u6362\u9875\u7B7E\u4E0D\u4F1A\u8986\u76D6\u3002": "Edit mode saves only this service; JSON and Form keep independent edits, and switching tabs never overwrites either.",
  "\u5F85\u6DFB\u52A0\u670D\u52A1\u5FC5\u987B\u5168\u90E8\u6D4B\u8BD5\u901A\u8FC7\uFF1B\u5DF2\u5B58\u5728\u7684\u540C\u540D\u670D\u52A1\u4F1A\u8DF3\u8FC7\uFF0C\u4FEE\u6539\u6587\u672C\u4E2D\u7684\u670D\u52A1\u540D\u540E\u53EF\u4F5C\u4E3A\u65B0\u670D\u52A1\u91CD\u6D4B\u3002": "Every service to add must pass the test. Existing names are skipped; rename in the text to add one as a new service.",
  "\u7C98\u8D34\u4E00\u4E2A\u6216\u591A\u4E2A\u670D\u52A1\u914D\u7F6E\uFF1B\u652F\u6301 JSON\u3001JSONC\u3001TOML \u548C mcpServers \u5BB9\u5668\u683C\u5F0F\u3002": "Paste one or more service configurations; JSON, JSONC, TOML, and mcpServers containers are supported.",
  "\u5C06\u5199\u5165 DSH \u7684\u914D\u7F6E": "Configuration that will be written to DSH",
  "\u51ED\u636E\u6309\u5B57\u6BB5\u540D\u906E\u853D\uFF1B\u5F15\u7528\u4FDD\u5B58\u4E3A $&#123;credential:\u2026&#125;\uFF0C\u7531 DSH \u51ED\u8BC1\u670D\u52A1\u5728\u8FDE\u63A5\u65F6\u89E3\u6790\u3002": "Credentials are masked by field name; references are saved as $&#123;credential:\u2026&#125; and resolved by the DSH credential service when connecting.",
  "\u53E6\u6709 ": "There are also ",
  " \u5904\u5DEE\u5F02\uFF0C\u89C1\u4E0B\u65B9\u5B8C\u6574\u914D\u7F6E\u3002": " differences; see the full configuration below.",
  "JSON \u7F16\u8F91": "JSON",
  "\u8868\u5355\u914D\u7F6E": "Form",
  "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539": "Unsaved changes",
  "\u670D\u52A1\u540D\u79F0": "Service name",
  "\u4F8B\u5982 context7": "e.g. context7",
  "\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u8FDE\u5B57\u7B26\uFF0C\u6700\u591A 32 \u4F4D\uFF1B\u6539\u540D\u4F1A\u5728\u4FDD\u5B58\u540E\u91CD\u5EFA\u8FDE\u63A5": "Letters, numbers, underscores, or hyphens, up to 32 characters; renaming rebuilds the connection after saving",
  "\u8FDE\u63A5\u65B9\u5F0F": "Transport",
  "\uFF08\u6682\u4E0D\u652F\u6301\uFF09": " (not supported)",
  "stdio \xB7 \u672C\u5730\u547D\u4EE4": "stdio \xB7 local command",
  "Streamable HTTP \xB7 \u8FDC\u7A0B\u670D\u52A1": "Streamable HTTP \xB7 remote service",
  "\u542F\u52A8\u547D\u4EE4": "Command",
  "npx\u3001uvx \u6216\u53EF\u6267\u884C\u6587\u4EF6\u7684\u7EDD\u5BF9\u8DEF\u5F84": "npx, uvx, or an absolute executable path",
  "\u5DE5\u4F5C\u76EE\u5F55": "Working directory",
  "\u5DE5\u4F5C\u76EE\u5F55 ": "Working directory ",
  "\u53EF\u9009": "Optional",
  "\u7559\u7A7A\u7531 DSH \u51B3\u5B9A": "Leave empty to let DSH decide",
  "\u672C\u5730\u547D\u4EE4\u7684\u8FD0\u884C\u76EE\u5F55\uFF1B\u547D\u4EE4\u6216\u53C2\u6570\u4F7F\u7528\u76F8\u5BF9\u8DEF\u5F84\u65F6\u586B\u5199\uFF0C\u4F8B\u5982\u9879\u76EE\u6839\u76EE\u5F55\u3002\u7559\u7A7A\u5219\u7EE7\u627F DSH \u5F53\u524D\u76EE\u5F55\u3002": "Working directory for local commands. Set it when the command or arguments use relative paths, for example a project root. Leave empty to inherit DSH's current directory.",
  "\u73AF\u5883\u53D8\u91CF": "Environment variables",
  "\u542F\u52A8\u53C2\u6570": "Arguments",
  "\uFF0B \u6DFB\u52A0\u53C2\u6570": "+ Add argument",
  "\u6BCF\u9879\u662F\u4E00\u4E2A\u53C2\u6570\uFF0C\u7A7A\u683C\u548C\u7A7A\u53C2\u6570\u4F1A\u539F\u6837\u4FDD\u7559\uFF1B\u4EC5\u9690\u85CF\u7591\u4F3C\u51ED\u8BC1\u3002": "Each item is one argument. Spaces and empty arguments are preserved; only likely credentials are hidden.",
  "\uFF0B \u6DFB\u52A0\u4E00\u9879": "+ Add one",
  "\u6CA1\u6709\u989D\u5916\u7684": "No extra ",
  "\u3002": ".",
  "\u672C\u5730 \xB7 ": "Local \xB7 ",
  "\u8FDC\u7A0B \xB7 ": "Remote \xB7 ",
  "\u8BF7\u6C42\u5934": "Headers",
  "\u5730\u5740\u4E2D\u7684\u51ED\u8BC1\u5DF2\u9690\u85CF\uFF0C\u4FEE\u6539\u5730\u5740\u65F6\u8BF7\u586B\u5199\u5B8C\u6574\u65B0\u5730\u5740\u3002": "Credentials in the URL are hidden. Enter the full new URL when changing it.",
  "\u6709\u914D\u7F6E\u9700\u8981\u6838\u5BF9": "Some configuration needs review",
  "\u6211\u5DF2\u6838\u5BF9\uFF0C\u786E\u8BA4\u4E0D\u8FC1\u79FB\u4E0A\u8FF0\u4E0D\u652F\u6301\u7684\u5B57\u6BB5": "I reviewed and confirm these unsupported fields will not be migrated",
  "\u6211\u5DF2\u6838\u5BF9\uFF0C\u786E\u8BA4\u4E0D\u8FC1\u79FB\u4E0A\u8FF0\u5B57\u6BB5": "I reviewed and confirm these fields will not be migrated",
  "\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u53EF\u4FEE\u6B63\u540E\u91CD\u8BD5": "Configuration saved; fix it and try again",
  "\u4FDD\u5B58\u914D\u7F6E\uFF0C\u4FDD\u6301\u505C\u7528": "Save configuration, keep disabled",
  "\u4FDD\u5B58\u540E\u9A8C\u8BC1\u6B63\u5F0F\u8FDE\u63A5\uFF1B\u65B0\u5EFA\u670D\u52A1\u9ED8\u8BA4\u542F\u7528": "Verify the real connection after saving; new services are enabled by default",
  "\u670D\u52A1\u5668\u914D\u7F6E": "Server configuration",
  "JSON \u914D\u7F6E": "JSON configuration",
  "\u683C\u5F0F": "Format",
  "\u914D\u7F6E\u683C\u5F0F": "Configuration format",
  "TOML \u652F\u6301\u6279\u91CF\u7C98\u8D34\uFF1B\u6539\u540D\u548C\u5220\u9664\u8BF7\u5728\u6587\u672C\u4E2D\u64CD\u4F5C\u3002": "TOML supports batch paste; renaming and deleting must be done in the text.",
  "\u53EF\u76F4\u63A5\u7C98\u8D34\u6574\u4EFD mcpServers \u914D\u7F6E\uFF1B\u91CD\u540D\u65F6\u5728\u6587\u672C\u4E2D\u6539\u540D\u540E\u91CD\u65B0\u6D4B\u8BD5\u3002": "Paste a full mcpServers configuration; rename duplicates in the text and test again.",
  "\u7C98\u8D34\u540E\u4F1A\u7ACB\u5373\u89E3\u6790\uFF1B\u53EF\u4EE5\u4E00\u6B21\u6DFB\u52A0\u591A\u4E2A\u670D\u52A1\u3002": "Paste to parse immediately; you can add multiple services at once.",
  "\u5DF2\u8BC6\u522B ": "Recognized ",
  " \u4E2A\u670D\u52A1": " services",
  "\u5F85\u6DFB\u52A0 ": "To add: ",
  "\u5DF2\u5B58\u5728\u8DF3\u8FC7 ": "Existing skipped: ",
  "\u91CD\u540D\u51B2\u7A81 ": "Duplicate names: ",
  "\u65E0\u6CD5\u89E3\u6790 ": "Unparseable: ",
  "\u9700\u6838\u5BF9 ": "Need review: ",
  "\u5DF2\u6D4B\u8BD5 ": "(tested ",
  "/": "/",
  "\u670D\u52A1\u5DF2\u8FDE\u63A5\uFF0C\u4F46\u5DE5\u5177\u5217\u8868\u83B7\u53D6\u5931\u8D25\uFF1B\u6DFB\u52A0\u540E\u4F1A\u518D\u6B21\u9A8C\u8BC1\u3002": "Connected, but the tool list could not be fetched; it will be verified again after adding.",
  "\u6D4B\u8BD5\u901A\u8FC7\uFF0C\u53EF\u4EE5\u6DFB\u52A0\u3002": "Test passed. Ready to add.",
  "\u8BF7\u586B\u5199\u670D\u52A1\u540D\u79F0": "Enter a service name",
  "\u540D\u79F0\u53EA\u80FD\u5305\u542B\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u8FDE\u5B57\u7B26\uFF0C1\u201332 \u4F4D": "Name must be 1\u201332 characters: letters, numbers, underscores, or hyphens",
  "\u5DF2\u5B58\u5728\u540C\u540D\u670D\u52A1\uFF1B\u8BF7\u4FEE\u6539\u540D\u79F0\u540E\u91CD\u8BD5": "A service with this name already exists; rename it and try again",
  "\u6CA1\u6709\u53EF\u4EE5\u6D4B\u8BD5\u7684\u670D\u52A1\uFF1B\u8BF7\u5148\u5904\u7406\u65E0\u6CD5\u89E3\u6790\u3001\u91CD\u540D\u6216\u9700\u8981\u6838\u5BF9\u7684\u914D\u7F6E\u3002": "No services to test. Fix the unparseable, duplicate, or review-needed rows first.",
  "\u5DF2\u53D6\u6D88\u6D4B\u8BD5\uFF1B\u5DF2\u5B8C\u6210\u7684\u6D4B\u8BD5\u7ED3\u679C\u4F1A\u4FDD\u7559\u3002": "Testing cancelled; completed results are kept.",
  "\u8FD9\u4E2A\u914D\u7F6E\u65E0\u6CD5\u5728\u884C\u5185\u5220\u9664\uFF0C\u8BF7\u5728\u6587\u672C\u4E2D\u5220\u9664\u5B83\u3002": "This configuration cannot be deleted inline; remove it from the text.",
  "\u8BF7\u5148\u586B\u5199\u5408\u6CD5\u7684\u670D\u52A1\u540D\u79F0": "Enter a valid service name first",
  "\u8BF7\u5148\u6838\u5BF9\u5E76\u786E\u8BA4\u4E0D\u8FC1\u79FB\u7684\u914D\u7F6E\u5B57\u6BB5": "Review and confirm the fields that will not be migrated",
  "\u8BF7\u5148\u8865\u5168\u914D\u7F6E": "Complete the configuration first",
  "\u4FDD\u5B58\u672A\u5B8C\u6210\uFF0C\u8BF7\u67E5\u770B\u4E0B\u65B9\u7684\u68C0\u67E5\u7ED3\u679C\u3002": "Save did not complete. Check the results below.",
  "\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u8FDE\u63A5\u9A8C\u8BC1\u672A\u901A\u8FC7\u3002\u8BF7\u8865\u5168\u540E\u91CD\u8BD5\uFF1B\u53EF\u5728\u5DF2\u6DFB\u52A0\u5217\u8868\u67E5\u770B\u72B6\u6001\u3002": "Saved, but connection verification failed. Fix it and retry; see the added list for status.",
  "JSON \u8FD8\u4E0D\u80FD\u89E3\u6790\uFF0C\u8BF7\u5148\u4FEE\u6B63\u6587\u672C\u4E2D\u7684\u9519\u8BEF\u3002": "JSON cannot be parsed yet. Fix the errors in the text first.",
  "\u7F16\u8F91\u6A21\u5F0F\u9700\u8981\u5728 JSON \u4E2D\u53EA\u4FDD\u7559\u4E00\u4E2A\u670D\u52A1\u914D\u7F6E": "Edit mode requires exactly one service in the JSON",
  "\u8BF7\u5148\u5904\u7406\u91CD\u540D\u6216\u9700\u8981\u6838\u5BF9\u7684\u914D\u7F6E\u5B57\u6BB5": "Resolve duplicate names or review-needed fields first",
  "\u6709\u670D\u52A1\u65E0\u6CD5\u89E3\u6790\uFF0C\u8BF7\u4FEE\u6B63\u6216\u5220\u9664\u8FD9\u4E9B\u884C\u540E\u518D\u6DFB\u52A0\u3002": "Some services cannot be parsed. Fix or remove those rows before adding.",
  "\u6709\u670D\u52A1\u91CD\u540D\uFF0C\u8BF7\u4FEE\u6539\u540D\u79F0\u6216\u5220\u9664\u91CD\u590D\u884C\u3002": "Some services have duplicate names. Rename them or remove the duplicate rows.",
  "\u6709\u914D\u7F6E\u9700\u8981\u6838\u5BF9\uFF0C\u8BF7\u9010\u884C\u786E\u8BA4\u540E\u518D\u6DFB\u52A0\u3002": "Some configurations need review. Confirm each row before adding.",
  "\u8BF7\u5148\u8BA9\u6240\u6709\u5F85\u6DFB\u52A0\u670D\u52A1\u901A\u8FC7\u8FDE\u63A5\u6D4B\u8BD5\u3002": "All services to add must pass the connection test first.",
  "\u6CA1\u6709\u53EF\u6DFB\u52A0\u7684\u670D\u52A1\u3002\u5DF2\u5B58\u5728\u7684\u670D\u52A1\u4F1A\u8DF3\u8FC7\uFF1B\u5982\u9700\u65B0\u589E\uFF0C\u8BF7\u4FEE\u6539\u540D\u79F0\u3002": "No services can be added. Existing services are skipped; rename them to add a new one.",
  "\u6CA1\u6709\u65B0\u7684\u670D\u52A1\u9700\u8981\u6DFB\u52A0\uFF1B\u5DF2\u5B58\u5728\u7684\u670D\u52A1\u4F1A\u88AB\u8DF3\u8FC7\u3002": "No new services to add; existing services are skipped.",
  "\u672C\u6B21\u6CA1\u6709\u5199\u5165\u4EFB\u4F55\u914D\u7F6E\uFF0C\u8BF7\u68C0\u67E5\u6D4B\u8BD5\u7ED3\u679C\u548C\u914D\u7F6E\u3002": "Nothing was written. Check the test results and configuration.",
  "\u5DF2\u540C\u6B65\u5230\u6700\u65B0\u7248\u672C\uFF0C\u8BF7\u518D\u6B21\u70B9\u51FB\u4FDD\u5B58": "Synced to the latest version; click Save again.",
  "\u672A\u547D\u540D\u670D\u52A1": "Unnamed service",
  "\u672A\u77E5": "Unknown",
  "\u65E0\u6CD5\u89E3\u6790": "Unparseable",
  "\u5DF2\u5B58\u5728 \xB7 \u5C06\u8DF3\u8FC7": "Exists \xB7 will be skipped",
  "\u91CD\u540D\u51B2\u7A81": "Duplicate name",
  "\u505C\u7528": "Disabled",
  "\u6D4B\u8BD5\u901A\u8FC7": "Test passed",
  "\u5DF2\u8FDE\u63A5 \xB7 \u5DE5\u5177\u53D1\u73B0\u5931\u8D25": "Connected \xB7 tool discovery failed",
  "\u6D4B\u8BD5\u5931\u8D25": "Test failed",
  "\u672A\u6D4B\u8BD5": "Untested",
  "\u8FD9\u4E2A\u670D\u52A1\u914D\u7F6E\u65E0\u6CD5\u89E3\u6790": "This service configuration cannot be parsed",
  "\u540D\u79F0\u5DF2\u5B58\u5728\uFF0C\u5C06\u8DF3\u8FC7\uFF1B\u5982\u9700\u4F5C\u4E3A\u65B0\u670D\u52A1\u6DFB\u52A0\uFF0C\u8BF7\u4FEE\u6539 JSON \u4E2D\u7684\u670D\u52A1\u540D\u540E\u91CD\u65B0\u6D4B\u8BD5\u3002": "Name already exists and will be skipped. To add it as a new service, rename it in the JSON and test again.",
  "\u4E0E\u5176\u4ED6\u5F85\u6DFB\u52A0\u670D\u52A1\u91CD\u540D\uFF1B\u8BF7\u4FEE\u6539 JSON \u4E2D\u7684\u670D\u52A1\u540D\u540E\u91CD\u65B0\u6D4B\u8BD5\u3002": "Duplicate name with another service to add. Rename it in the JSON and test again.",
  "\u6D4B\u8BD5\u4E2D\u2026": "Testing\u2026",
  "\u6D4B\u8BD5\u8FDE\u63A5": "Test connection",
  "\u6CA1\u6709\u53EF\u6DFB\u52A0": "Nothing to add",
  "\u6DFB\u52A0": "Add",
  "\u540C\u6B65\u6700\u65B0\u7248\u672C": "Sync latest",
  "\u4FDD\u5B58": "Save",
  "\u4FDD\u5B58\u4E2D\u2026": "Saving\u2026",
  "\u6D4B\u8BD5\u5168\u90E8": "Test all",
  "\u53D6\u6D88\u6D4B\u8BD5": "Cancel tests",
  "\u6B63\u5728\u6D4B\u8BD5\u8FDE\u63A5\u2026": "Testing connection\u2026",
  "\u6B63\u5728\u4FDD\u5B58\u2026": "Saving\u2026",
  "\u542F\u52A8\u670D\u52A1\u5E76\u5B8C\u6210\u63E1\u624B": "Starting the server and completing the handshake",
  "\u914D\u7F6E\u68C0\u67E5\u672A\u901A\u8FC7": "Configuration check failed",
  "\u8FDE\u63A5\u6B63\u5E38": "Connected",
  "\u670D\u52A1\u53EF\u7528\uFF0C\u53EF\u4EE5\u6DFB\u52A0": "Service is available and can be added",
  "\u5DF2\u8FDE\u63A5\uFF0C\u4F46\u5DE5\u5177\u53D1\u73B0\u5931\u8D25": "Connected, but tool discovery failed",
  "\u8FDE\u63A5\u5DF2\u5EFA\u7ACB\uFF0C\u4F46\u6D4B\u8BD5\u8FDB\u7A0B\u672A\u6E05\u7406": "Connected, but the test process was not cleaned up",
  "\u67E5\u770B\u68C0\u67E5\u8BE6\u60C5": "View check details",
  "\uFF08\u5DF2\u6D4B\u8BD5 ": " (tested ",
  "\uFF09": ")",
  // Sources
  " \u9879\u914D\u7F6E": " configurations",
  " \u9879": " ",
  "\u672C\u5730\u547D\u4EE4": "Local command",
  "\u8FDC\u7A0B\u670D\u52A1": "Remote service",
  "\u9879\u76EE\u7EA7 \xB7 ": "Project-level \xB7 ",
  "\u540C\u540D\u5DF2\u5B58\u5728\uFF0C\u4F46\u914D\u7F6E\u4E0D\u540C\uFF08\u5BFC\u51FA\u914D\u7F6E\u65F6\u53EF\u80FD\u7701\u7565\u4E86\u51ED\u636E\uFF09\uFF1B\u786E\u8BA4\u662F\u65B0\u670D\u52A1\u65F6\u8BF7\u6539\u540D\u6DFB\u52A0": "Same name exists with a different configuration (credentials may have been omitted from the export). Rename it if this is a new service.",
  "\u6709 ": "There are ",
  " \u9879\u914D\u7F6E\u9700\u8981\u6838\u5BF9": " configuration fields to review",
  "\u4E5F\u53D1\u73B0\u4E8E ": "Also found in ",
  "\u5DF2\u6DFB\u52A0 \xB7 ": "Added \xB7 ",
  "\uFF08\u51ED\u636E\u672A\u968F\u5907\u4EFD\u5BFC\u5165\uFF09": " (credentials were not imported with the backup)",
  " \u7684\u914D\u7F6E\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u8BF7\u68C0\u67E5\u6587\u4EF6\u683C\u5F0F\u548C\u6743\u9650\u3002": " configuration could not be read. Check the file format and permissions.",
  "\u9879\u914D\u7F6E": " configurations",
  // Toasts / dynamic labels
  "\u5DF2\u4FDD\u5B58": "Saved",
  "\u5DF2\u4FDD\u5B58\uFF0C\u4FDD\u6301\u505C\u7528": "Saved, kept disabled",
  "\u5DF2\u4FDD\u5B58\uFF0C\u6B63\u5728\u9A8C\u8BC1\u8FDE\u63A5": "Saved, verifying connection",
  "\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u914D\u7F6E": "Nothing to export",
  "\u6CA1\u6709\u9700\u8981\u91CD\u8FDE\u7684\u670D\u52A1": "No services need reconnecting",
  // Host-facing messages
  "\u4E00\u6B21\u6700\u591A\u6DFB\u52A0 100 \u4E2A\u670D\u52A1": "You can add at most 100 services at once",
  "\u4E0D\u652F\u6301\u7684\u6279\u91CF\u64CD\u4F5C": "Unsupported bulk operation",
  "\u4E0D\u652F\u6301\u7684\u64CD\u4F5C": "Unsupported operation",
  "\u4E0D\u652F\u6301\u8BFB\u53D6\u6B64\u5B57\u6BB5": "This field cannot be read",
  "\u4E0E\u5F53\u524D\u8FDE\u63A5\u65B9\u5F0F\u4E0D\u517C\u5BB9\uFF08\u672A\u8FC1\u79FB\uFF09\uFF1A": "Incompatible with the current transport (not migrated): ",
  "\u4F7F\u7528 1\u201332 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u8FDE\u5B57\u7B26": "Use 1\u201332 letters, numbers, underscores, or hyphens",
  "\u53C2\u6570\u5305\u542B\u76F8\u5BF9\u6587\u4EF6\u8DEF\u5F84\uFF0C\u8BF7\u660E\u786E\u586B\u5199\u5DE5\u4F5C\u76EE\u5F55\u540E\u91CD\u8BD5": "An argument contains a relative path. Set a working directory and retry.",
  "\u53C2\u6570\u6309\u6570\u7EC4\u4F20\u9012\uFF0C\u4E0D\u4F7F\u7528 Shell \u62FC\u63A5": "Arguments are passed as an array, without shell concatenation",
  "\u540D\u79F0\u65E0\u6548\uFF1A": "Invalid name: ",
  "\u540D\u79F0\u6709\u6548": "Name is valid",
  "\u547D\u4EE4\u53C2\u6570\u4E2D\u5305\u542B\u5F85\u66FF\u6362\u7684\u53D8\u91CF\uFF0C\u8BF7\u5728\u4FDD\u5B58\u524D\u8865\u5168": "An argument contains a variable to replace; fill it in before saving",
  "\u5B98\u65B9 MCP \u76EE\u5F55\u6CA1\u6709\u8FD4\u56DE\u8FD9\u4E2A\u670D\u52A1": "The official MCP Registry did not return this service",
  "\u5B98\u65B9 MCP \u76EE\u5F55\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ": "Official MCP Registry request failed (HTTP ",
  "\u5B98\u65B9 MCP \u76EE\u5F55\u8BF7\u6C42\u8D85\u65F6": "Official MCP Registry request timed out",
  "\u5B98\u65B9 MCP \u76EE\u5F55\u8FD4\u56DE\u4E86\u65E0\u6CD5\u89E3\u6790\u7684\u6570\u636E": "The official MCP Registry returned unparseable data",
  "\u5DF2\u53D6\u6D88": "Cancelled",
  "\u5DF2\u53D6\u6D88\u9A8C\u8BC1": "Verification cancelled",
  "\u5DF2\u5B58\u5728": "Already exists",
  "\u5DF2\u64A4\u9500\u8FD9\u6B21\u6DFB\u52A0": "This addition was undone",
  "\u5DF2\u6709\u540C\u540D\u670D\u52A1\u5668\uFF0C\u8BF7\u4FEE\u6539\u540D\u79F0": "A server with this name already exists; rename it",
  "\u5DF2\u88AB\u4FEE\u6539": "was modified",
  "\u5DF2\u88AB\u5220\u9664\u6216\u6539\u540D": "was deleted or renamed",
  "\u5DF2\u88AB\u65B0\u7684\u4FDD\u5B58\u8BF7\u6C42\u53D6\u4EE3": "was superseded by a newer save",
  "\u5F53\u524D DSH \u7248\u672C\u4E0D\u652F\u6301 SSE \u4F20\u8F93\uFF0C\u8BF7\u4F7F\u7528\u8BE5\u670D\u52A1\u7684 HTTP \u5730\u5740\u6216\u672C\u5730\u5305": "This DSH version does not support SSE transport. Use the service's HTTP endpoint or local package.",
  "\u5F53\u524D\u4EC5\u652F\u6301 stdio \u548C Streamable HTTP": "Only stdio and Streamable HTTP are supported",
  "\u626B\u63CF\u7ED3\u679C\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u626B\u63CF\u540E\u518D\u6DFB\u52A0": "The scan result expired. Scan again before adding.",
  "\u6279\u91CF\u914D\u7F6E\u7F3A\u5C11\u670D\u52A1\u540D\u79F0": "A batch entry is missing a service name",
  "\u627E\u4E0D\u5230\u8BE5\u670D\u52A1\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5": "Service not found. Refresh and retry.",
  "\u627E\u4E0D\u5230\u8FD9\u4E2A\u5BFC\u5165\u6765\u6E90\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5": "Import source not found. Refresh and retry.",
  "\u63A5\u53E3\u4E0D\u5B58\u5728": "Endpoint not found",
  "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u914D\u7F6E\u548C DSH \u72B6\u6001\u540E\u91CD\u8BD5": "Operation failed. Check the configuration and DSH status, then retry.",
  "\u65E0\u6548\u8BF7\u6C42": "Invalid request",
  "\u65E0\u6CD5\u6821\u9A8C\u6B64\u914D\u7F6E\uFF1A": "Could not validate this configuration: ",
  "\u65E0\u6CD5\u89E3\u6790\u6B64\u670D\u52A1\u5668\u914D\u7F6E": "Could not parse this server configuration",
  "\u914D\u7F6E\u5B57\u6BB5 env \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u952E\u503C\u5BF9\u8C61": "The env field must be an object of string values",
  "\u65E0\u6CD5\u8BFB\u53D6\u6216\u89E3\u6790\u914D\u7F6E\uFF0C\u8BF7\u68C0\u67E5\u683C\u5F0F\u548C\u6587\u4EF6\u6743\u9650": "Could not read or parse the configuration. Check the format and file permissions.",
  "\u65E0\u6CD5\u8FDE\u63A5\u5B98\u65B9 MCP \u76EE\u5F55\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5": "Could not reach the official MCP Registry. Try again later.",
  "\u6682\u4E0D\u652F\u6301 ": "Not supported: ",
  "\u6682\u4E0D\u652F\u6301\u6B64\u4F20\u8F93\u65B9\u5F0F\uFF1A": "Unsupported transport: ",
  "\u670D\u52A1\u5668\u914D\u7F6E\u5FC5\u987B\u662F\u5BF9\u8C61": "The server configuration must be an object",
  "\u670D\u52A1\u5730\u5740\u5305\u542B\u5F85\u66FF\u6362\u7684\u53D8\u91CF\uFF0C\u8BF7\u5728\u4FDD\u5B58\u524D\u8865\u5168": "The URL contains a variable to replace; fill it in before saving",
  "\u670D\u52A1\u5DF2\u505C\u7528\uFF0C\u9A8C\u8BC1\u7ED3\u675F": "Service disabled; verification ended",
  "\u670D\u52A1\u5DF2\u88AB\u5220\u9664\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5": "The service was deleted. Refresh and retry.",
  "\u672A\u4FDD\u5B58\u914D\u7F6E\uFF0C\u672A\u6CE8\u518C\u5DE5\u5177\u5230\u4F1A\u8BDD": "Configuration was not saved; tools were not registered in the session",
  "MCP Hub \u65E0\u6CD5\u89E3\u6790\u670D\u52A1 ": "MCP Hub could not parse service ",
  "MCP Hub \u8BFB\u53D6\u8FDE\u63A5\u72B6\u6001\u5931\u8D25": "MCP Hub could not read connection status",
  "MCP Hub \u7B49\u5F85\u5B98\u65B9 MCP Manager\u3001Settings \u548C\u5DE5\u5177\u670D\u52A1\uFF0C\u8BF7\u68C0\u67E5 DSH \u7248\u672C\u53CA\u63D2\u4EF6\u72B6\u6001": "MCP Hub is waiting for the official MCP Manager, Settings, and Tools services. Check the DSH version and plugin status.",
  "\u65E0": "unknown",
  "\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A\u6216\u91CD\u590D": "Name cannot be empty or duplicated",
  "\u540D\u79F0 ": "Name ",
  "\u914D\u7F6E\u65B9\u5F0F ": "Mode ",
  "\u503C ": "Value ",
  "\u586B\u5199\u503C": "Enter a value",
  "\u4F8B\u5982 GITHUB_TOKEN": "e.g. GITHUB_TOKEN",
  "\u51ED\u8BC1\u540D\u79F0": "Credential name",
  "\u9690\u85CF": "Hide",
  "\u663E\u793A": "Show",
  "\u590D\u5236": "Copy",
  "\u590D\u5236\u5BC6\u94A5": "Copy key",
  "\u663E\u793A\u5BC6\u94A5": "Show key",
  "\u9690\u85CF\u5BC6\u94A5": "Hide key",
  "\u7F16\u8F91\u5BC6\u94A5": "Edit key",
  "\u5DF2\u590D\u5236": "Copied",
  " \xB7 \u5DF2\u590D\u5236": " \xB7 Copied",
  "\u6D4B\u8BD5\u5E76\u4FDD\u5B58": "Test and save",
  "\u53D6\u6D88\u7F16\u8F91": "Cancel editing",
  "\u8F93\u5165\u65B0\u5BC6\u94A5": "Enter a new secret",
  "\u6D4B\u8BD5\u901A\u8FC7\u540E\u624D\u4F1A\u5199\u5165\uFF1B\u5931\u8D25\u4FDD\u7559\u539F\u503C": "Written only after the test passes; the original value is kept on failure",
  "\u65B0\u5BC6\u94A5\u5DF2\u901A\u8FC7\u6D4B\u8BD5\uFF0C\u4FDD\u5B58\u540E\u5199\u5165 DSH \u51ED\u8BC1": "New secret passed the test; stored in DSH credentials on save",
  "\u4FDD\u5B58\u540E\u5199\u5165 DSH \u51ED\u8BC1": "Stored in DSH credentials on save",
  "\u5DF2\u663E\u793A\uFF0C\u5269 ": "Shown, ",
  " \u79D2\u81EA\u52A8\u9690\u85CF": " s left",
  "\u79FB\u9664 ": "Remove ",
  "\u5DF2\u914D\u7F6E\uFF08\u6765\u81EA ": "Configured (from ",
  "\u5F53\u524D\u662F\u5F15\u7528\uFF1B\u6539\u6210\u5177\u4F53\u503C\u4F1A\u5199\u5165 DSH \u51ED\u8BC1": "This is currently a reference; typing a concrete value stores it in DSH credentials.",
  "\uFF1B\u76F4\u63A5\u586B\u5199\u503C\u5373\u53EF\uFF0C\u4FDD\u5B58\u65F6\u5199\u5165 DSH \u51ED\u8BC1": ". Type the value here; it is stored in DSH credentials on save.",
  "\u7531 DSH \u51ED\u8BC1\u670D\u52A1\u89E3\u6790\uFF0C\u8FDE\u63A5\u65F6\u9A8C\u8BC1": "Resolved by the DSH credential service and verified when connecting.",
  "\u4FDD\u5B58\u4E3A ${credential:\u2026} \u5F15\u7528\uFF0C\u8FDE\u63A5\u65F6\u4ECE DSH \u51ED\u8BC1\u670D\u52A1\u8BFB\u53D6": "Saved as a ${credential:\u2026} reference and read from the DSH credential service when connecting.",
  "\u5DF2\u914D\u7F6E\uFF1B\u4FDD\u6301\u539F\u6837\u5C06\u4FDD\u7559\u539F\u503C": "Configured; leave it unchanged to keep the current value.",
  "\u5DF2\u586B\u5199": "Filled",
  "\u672A\u586B\u5199": "Not filled",
  "\u542F\u52A8\u53C2\u6570 ": "Argument ",
  "\u5220\u9664\u53C2\u6570 ": "Remove argument ",
  "\u6536\u8D77 ": "Collapse ",
  "\u5C55\u5F00 ": "Expand ",
  "\u63D2\u4EF6\u7BA1\u7406": "Plugin",
  "\u670D\u52A1\u5DF2\u8FDE\u63A5\uFF0C\u4F46\u6CA1\u6709\u8FD4\u56DE\u5DE5\u5177\uFF1B\u5DE5\u5177\u6E05\u5355\u7531\u4FDD\u5B58\u540E\u7684\u6B63\u5F0F\u8FDE\u63A5\u91CD\u65B0\u83B7\u53D6\uFF0C\u53EF\u5728\u300C\u8BCA\u65AD\u300D\u4E2D\u590D\u8BCA\u3002": "Connected, but no tools were returned. The tool list is refreshed from the real connection after saving; use Diagnostics to re-check.",
  " \u7684\u5DE5\u5177": " tools",
  "\u79FB\u9664\u5BFC\u5165\u6765\u6E90 ": "Remove import source ",
  "\u6B63\u5728\u52A0\u8F7D\u66F4\u591A\u2026": "Loading more\u2026",
  "\u914D\u7F6E\u6587\u4EF6\u8D85\u8FC7 200 KB\uFF0C\u8BF7\u4F7F\u7528\u8F83\u5C0F\u7684 MCP \u914D\u7F6E\u6587\u4EF6": "The configuration file is larger than 200 KB. Use a smaller MCP configuration file.",
  "\u76F4\u63A5\u586B\u5199": "Enter directly",
  "\u73AF\u5883\u53D8\u91CF\u5F15\u7528": "Environment variable reference",
  "DSH \u51ED\u8BC1\u5F15\u7528": "DSH credential reference",
  "\u670D\u52A1\u540D": "Service name",
  "\u9884\u89C8": "Preview",
  "\u670D\u52A1\u5730\u5740": "Service URL",
  "\u63D0\u4EA4": "Submit",
  "\u7EE7\u7EED": "Continue",
  "\u67E5\u770B": "View",
  "\u5173\u95ED": "Close",
  "\u5B8C\u6210": "Done",
  "\u672A\u77E5\u72B6\u6001": "Unknown status",
  '{\n  "mcpServers": {\n    "\u670D\u52A1\u540D": { "command": "npx", "args": ["-y", "some-mcp"] }\n  }\n}': '{\n  "mcpServers": {\n    "service-name": { "command": "npx", "args": ["-y", "some-mcp"] }\n  }\n}',
  "\u7F3A\u5C11\u8981\u67E5\u770B\u7684\u670D\u52A1\u540D\u79F0": "Missing service name",
  "\u7F3A\u5C11\u53D8\u91CF\uFF1A": "Missing variables: ",
  "\u5F15\u7528\u5DF2\u89E3\u6790\uFF1B\u51ED\u8BC1\u5F15\u7528\u5C06\u5728\u6B63\u5F0F\u8FDE\u63A5\u65F6\u9A8C\u8BC1": "References resolved; credential references will be verified on the real connection.",
  "\u5C06\u4FDD\u5B58\u4E3A ${credential:\u2026} \u5F15\u7528\uFF0C\u7531 DSH \u51ED\u8BC1\u670D\u52A1\u5728\u8FDE\u63A5\u65F6\u89E3\u6790": "Saved as a ${credential:\u2026} reference, resolved by the DSH credential service when connecting.",
  "\u53D8\u91CF\u4E0E\u8BF7\u6C42\u5934\u540D\u79F0": "Variable and header names",
  "\u5BC6\u94A5\u586B\u5199": "Credentials",
  "\u8BF7\u586B\u5199\uFF1A": "Please fill in: ",
  "\u6CA1\u6709\u5FC5\u586B\u9879\u7559\u7A7A": "Leave empty if nothing is required",
  "\u76EE\u5F55\u4E0D\u5B58\u5728\u6216\u4E0D\u53EF\u8BBF\u95EE": "Directory does not exist or is not accessible",
  "\u672A\u6307\u5B9A\uFF0C\u7531 DSH \u51B3\u5B9A": "Not specified; DSH decides",
  "\u51ED\u8BC1\u5C06\u5728\u6B63\u5F0F\u542F\u52A8\u65F6\u89E3\u6790": "Credentials will be resolved when the service starts.",
  "DSH \u7684 PATH \u4E2D\u627E\u4E0D\u5230\u53EF\u6267\u884C\u547D\u4EE4\uFF0C\u8BF7\u586B\u5199\u7EDD\u5BF9\u8DEF\u5F84": "The command was not found in DSH's PATH. Enter an absolute path.",
  "\u76F8\u5BF9\u8DEF\u5F84": "Relative path",
  "HTTP \u5730\u5740\u6709\u6548\uFF0C\u8BA4\u8BC1\u5C06\u5728\u8FDE\u63A5\u65F6\u9A8C\u8BC1": "HTTP address is valid; authentication will be verified when connecting.",
  "\u8BF7\u586B\u5199\u6709\u6548\u7684 HTTP / HTTPS \u5730\u5740": "Enter a valid HTTP / HTTPS address",
  "\u4F20\u8F93\u65B9\u5F0F": "Transport",
  "\u8D85\u65F6\u8BBE\u7F6E": "Timeout",
  "\u9700\u8981 JSON \u8BF7\u6C42": "A JSON request is required",
  "\u914D\u7F6E\u5185\u5BB9\u8FC7\u5927": "Configuration is too large",
  "\u8BF7\u6C42\u4E0D\u662F\u6709\u6548\u7684 JSON": "The request is not valid JSON",
  "MCP Hub \u672A\u627E\u5230 profile \u4E0A\u4E0B\u6587\uFF0C\u6765\u6E90\u8BB0\u5F55\u5C06\u4E0D\u4F1A\u6301\u4E45\u5316": "MCP Hub could not find the profile context; source records will not persist.",
  "\uFF08\u5217\u8868\u5DF2\u622A\u65AD\uFF09": " (list truncated)",
  "\u6D4B\u8BD5\u6E05\u7406\u672A\u5B8C\u6210\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u8FDB\u7A0B\u540E\u91CD\u8BD5": "Test cleanup did not finish. Check the service process and retry.",
  "\u670D\u52A1\u5DF2\u8FDE\u63A5\uFF0C\u4F46\u5DE5\u5177\u5217\u8868\u83B7\u53D6\u5931\u8D25\uFF1A": "Connected, but the tool list could not be fetched: ",
  "\u72B6\u6001\u672A\u77E5": "Unknown status",
  "MCP Hub \u6765\u6E90\u8BB0\u5F55\u4E0D\u53EF\u8BFB\uFF0C\u5C06\u7EE7\u7EED\u8BFB\u53D6\u670D\u52A1\u914D\u7F6E": "MCP Hub source records are unreadable; continuing with the service configuration.",
  "\u672A\u627E\u5230\u5B98\u65B9 MCP Manager \u7684\u53EF\u5199\u914D\u7F6E\uFF0C\u8BF7\u5148\u542F\u7528 DSH MCP Manager": "No writable official MCP Manager configuration was found. Enable the DSH MCP Manager first.",
  "MCP Hub \u65E0\u6CD5\u8BFB\u53D6\u5DE5\u5177\u5217\u8868": "MCP Hub could not read the tool list",
  "\u7F3A\u5C11\u670D\u52A1\u540D\u79F0": "Missing service name",
  "\u7F3A\u5C11\u6709\u6548\u7684\u8FDE\u63A5\u65B9\u5F0F": "Missing a valid transport",
  "DSH \u914D\u7F6E": "DSH configuration",
  "\u914D\u7F6E\u6761\u76EE\u65E0\u6CD5\u8BFB\u53D6\uFF1A": "Could not read the configuration entry: ",
  "\u7F3A\u5C11\u914D\u7F6E\u6587\u4EF6\u5185\u5BB9": "Missing configuration file contents",
  "[\u9690\u85CF]": "[hidden]",
  "\u9879\u76EE .env": "Project .env",
  "\u542F\u52A8\u73AF\u5883": "Startup environment",
  "\u5F53\u524D\u9879\u76EE": "Current project",
  "\u51ED\u8BC1\u5F15\u7528": "Credential reference",
  "\u73AF\u5883\u5F15\u7528": "Environment reference",
  "\u914D\u7F6E\u540D\u79F0": "Configuration name",
  "\u53D8\u91CF\u5F15\u7528": "Variable reference"
};
var DYNAMIC = [
  [/^第 (\d+)\/(\S+) 次重试$/, "Attempt $1/$2"],
  [/^状态未知（(.+)）$/, "Unknown status ($1)"],
  [/^已请求重连 (\d+) 个服务$/, "Reconnect requested for $1 services"],
  [/^已导出 (\d+) 个服务$/, "Exported $1 services"],
  [/^已导出 (\d+) 个服务（包含密钥），请妥善保管$/, "Exported $1 services with secrets. Keep the file safe."],
  [/^已导出 (\d+) 个服务；(\d+) 个凭据字段未导出，恢复后需重新填写$/, "Exported $1 services; $2 credential fields were omitted and must be re-entered after restore."],
  [/^已导出 (\d+) 个服务；(\d+) 个凭证未配置，仍以引用形式导出$/, "Exported $1 services; $2 credentials are not configured and stay as references."],
  [/^已写入 DSH 凭证：(.+)$/, "Stored in DSH credentials: $1"],
  [/^已删除 (.+)；(\d+) 个凭证已无引用，可在 DSH 凭证管理中清理$/, "Deleted $1; $2 credentials are no longer referenced and can be cleaned up in DSH credentials."],
  [/^(.+) 已保存，正在验证连接（密钥已写入 DSH 凭证）$/, "$1 saved; verifying the connection (secrets stored as DSH credentials)"],
  [/^(.+) 已保存，保持停用（密钥已写入 DSH 凭证）$/, "$1 saved and kept disabled (secrets stored as DSH credentials)"],
  [/^(\d+) 个 MCP 服务$/, "$1 MCP services"],
  [/^(\d+) 个工具$/, "$1 tools"],
  [/^(\d+) 项配置$/, "$1 configurations"],
  [/^(\d+) 项$/, "$1 "],
  [/^已识别 (\d+) 个服务$/, "$1 services recognized"],
  [/^添加 (\d+) 个$/, "Add $1"],
  [/^无法解析此服务器配置：(.+)$/, "Could not parse this server configuration: $1"],
  [/^有 (\d+) 项配置需要核对：(.+)$/, "$1 configuration fields need review: $2"],
  [/^有 (\d+) 项配置需要核对$/, "$1 configuration fields need review"],
  [/^服务「(.+)」未通过校验，本次没有写入任何配置。$/, 'Service "$1" failed validation; nothing was written.'],
  [/^已配置（来自 (.+)）$/, "Configured (from $1)"],
  [/^找不到引用：(.+)$/, "Missing references: $1"],
  [/^展开 (.+)$/, "Expand $1"],
  [/^收起 (.+)$/, "Collapse $1"],
  [/^启动参数 (\d+)$/, "Argument $1"],
  [/^删除参数 (\d+)$/, "Remove argument $1"],
  [/^移除 (.+)$/, "Remove $1"],
  [/^(Environment variables|Headers)名称 (\d+)$/, "$1 name $2"],
  [/^(Environment variables|Headers)配置方式 (\d+)$/, "$1 mode $2"],
  [/^(Environment variables|Headers)值 (\d+)$/, "$1 value $2"],
  [/^需要填写环境变量 (.+)$/, "Enter environment variable $1"],
  [/^需要填写请求头 (.+)$/, "Enter header $1"],
  [/^(.+) 是密钥，建议使用 DSH 凭证引用$/, "$1 is a secret; use a DSH credential reference"],
  [/^(.+) 包含待替换的变量$/, "$1 contains a variable to replace"],
  [/^不支持 (.+) 包类型的自动转换$/, "Automatic conversion for $1 packages is not supported"],
  [/^服务已连接，但工具列表获取失败：(.+)$/, "Connected, but the tool list could not be fetched: $1"],
  [/^本地 · (.+)$/, "Local \xB7 $1"],
  [/^远程 · (.+)$/, "Remote \xB7 $1"],
  [/^编辑 (.+)$/, "Edit $1"],
  [/^删除 (.+)$/, "Delete $1"],
  [/^重启 (.+)$/, "Restart $1"],
  [/^取消验证 (.+)$/, "Cancel verification for $1"],
  [/^移除导入来源 (.+)$/, "Remove import source $1"],
  [/^搜索 (.+) 的工具$/, "Search $1 tools"],
  [/^启用 (.+)$/, "Enable $1"],
  [/^(.+)（暂不支持）$/, "$1 (not supported)"],
  [/^(.+) 项配置$/, "$1 configurations"],
  [/^(.+) 的配置无法读取，请检查文件格式和权限。$/, "Could not read $1 configuration. Check the file format and permissions."],
  [/^将写入 DSH 的配置（(\d+) 处与来源不同）$/, "Configuration to write to DSH ($1 differences from the source)"],
  [/^另有 (\d+) 处差异，见下方完整配置。$/, "$1 more differences; see the full configuration below."],
  [/^已测试 (\d+)\/(\d+)$/, "(tested $1/$2)"],
  [/^测试中 (\d+)\/(\d+)$/, "Testing $1/$2"]
];
var active = "zh";
function setLocale(locale) {
  const next = String(locale ?? "").toLowerCase();
  active = next.startsWith("zh") ? "zh" : "en";
}
function translate(value) {
  if (active === "zh" || typeof value !== "string" || !/[\u3400-\u9fff]/.test(value)) return value;
  const exact = EN[value];
  if (exact !== void 0) return exact;
  if (value.startsWith("\u65E0\u6CD5\u89E3\u6790\u6B64\u670D\u52A1\u5668\u914D\u7F6E\uFF1A")) {
    const inner = value.slice("\u65E0\u6CD5\u89E3\u6790\u6B64\u670D\u52A1\u5668\u914D\u7F6E\uFF1A".length);
    return `Could not parse this server configuration: ${EN[inner] ?? inner}`;
  }
  if (value.startsWith("\u5DF2\u8BC6\u522B ")) {
    return value.replace(/^已识别 (\d+) 个服务/, "Recognized $1 services").replace(/待添加 (\d+)/g, "to add: $1").replace(/已存在跳过 (\d+)/g, "existing skipped: $1").replace(/重名冲突 (\d+)/g, "duplicate names: $1").replace(/无法解析 (\d+)/g, "unparseable: $1").replace(/需核对 (\d+)/g, "need review: $1");
  }
  if (value.includes("\uFF08\u5DF2\u6D4B\u8BD5 ")) {
    const [head, tail] = value.split("\uFF08\u5DF2\u6D4B\u8BD5 ");
    const translated = EN[head] ?? head;
    return `${translated}(tested ${tail.replace("\uFF09", ")")}`;
  }
  for (const [pattern, replacement] of DYNAMIC) {
    if (pattern.test(value)) return value.replace(pattern, replacement);
  }
  return value;
}
var TEXT_PROPS = /* @__PURE__ */ new Set(["title", "placeholder", "aria-label", "alt", "label", "confirmLabel", "description"]);
function localizeChildren(children) {
  return children.map((child) => {
    if (typeof child === "string") return translate(child);
    if (Array.isArray(child)) return localizeChildren(child);
    return child;
  });
}
function h(type, props, ...children) {
  let nextProps = props;
  if (props && typeof props === "object") {
    for (const key of TEXT_PROPS) {
      if (typeof props[key] === "string") {
        if (nextProps === props) nextProps = { ...props };
        nextProps[key] = translate(props[key]);
      }
    }
    if (typeof props.children === "string" && translate(props.children) !== props.children) {
      if (nextProps === props) nextProps = { ...props };
      nextProps.children = translate(props.children);
    }
  }
  return import_react.default.createElement(type, nextProps, ...localizeChildren(children));
}

// src/client/App.jsx
var MASK = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
var STATUS2 = { connected: ["\u5DF2\u8FDE\u63A5", "good"], disabled: ["\u5DF2\u505C\u7528", "muted"], connecting: ["\u8FDE\u63A5\u4E2D", "warn"], reconnecting: ["\u91CD\u8FDE\u4E2D", "warn"], "waiting-credentials": ["\u7F3A\u5C11\u51ED\u8BC1", "warn"], failed: ["\u8FDE\u63A5\u5931\u8D25", "bad"], closed: ["\u672A\u8FDE\u63A5", "muted"] };
var REASON = { "gave-up": "\u91CD\u8FDE\u9884\u7B97\u5DF2\u8017\u5C3D\uFF0C\u5DE5\u5177\u5DF2\u64A4\u56DE", "reconnect-disabled": "\u91CD\u8FDE\u5DF2\u5173\u95ED\uFF0C\u8FDE\u63A5\u4E2D\u65AD\u540E\u4E0D\u518D\u6062\u590D", "unclosed-generation": "\u4E0A\u6B21\u8FDE\u63A5\u672A\u786E\u8BA4\u5173\u95ED\uFF0C\u5DF2\u963B\u6B62\u66FF\u6362", load: "\u542F\u52A8\u5931\u8D25", cleanup: "\u6E05\u7406\u672A\u5B8C\u6210\uFF0C\u9700\u8981\u91CD\u542F DSH" };
var MANAGED = { config: null, inherited: "\u7EE7\u627F\u914D\u7F6E", plugin: "\u63D2\u4EF6\u6CE8\u518C", cleanup: "\u5DF2\u5220\u9664\uFF0C\u6E05\u7406\u4E2D", broken: "\u914D\u7F6E\u5F02\u5E38" };
var isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function diffRows(from = {}, to = {}, path = []) {
  const rows = [];
  const keys = /* @__PURE__ */ new Set([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]);
  for (const key of keys) {
    const a = from?.[key], b = to?.[key];
    if (isPlainObject(a) && isPlainObject(b)) {
      rows.push(...diffRows(a, b, path.concat(key)));
      continue;
    }
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    rows.push({ path: path.concat(key).join("."), from: a, to: b });
  }
  return rows;
}
var showValue = (value) => value === void 0 ? "\uFF08\u672A\u8BBE\u7F6E\uFF09" : typeof value === "string" ? value === MASK ? "\uFF08\u5DF2\u9690\u85CF\uFF09" : value : JSON.stringify(value);
function download(name, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
var ICONS = {
  plus: /* @__PURE__ */ h("path", { d: "M12 5v14M5 12h14" }),
  refresh: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }), /* @__PURE__ */ h("path", { d: "M21 3v5h-5" }), /* @__PURE__ */ h("path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }), /* @__PURE__ */ h("path", { d: "M8 16H3v5" })),
  chevron: /* @__PURE__ */ h("path", { d: "m9 5 7 7-7 7" }),
  search: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("circle", { cx: "10.5", cy: "10.5", r: "6.5" }), /* @__PURE__ */ h("path", { d: "m16 16 4 4" })),
  edit: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("path", { d: "m15 4 5 5-11 11H4v-5zM12 7l5 5" })),
  trash: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("path", { d: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" })),
  check: /* @__PURE__ */ h("path", { d: "m5 12 4 4L19 6" }),
  close: /* @__PURE__ */ h("path", { d: "m6 6 12 12M6 18 18 6" }),
  box: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("path", { d: "m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5l10 6" })),
  import: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("path", { d: "M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6" })),
  folder: /* @__PURE__ */ h("path", { d: "M3 6h7l2 3h9v11H3z" }),
  arrow: /* @__PURE__ */ h("path", { d: "M4 12h16m-6-6 6 6-6 6" }),
  external: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("path", { d: "M14 4h6v6" }), /* @__PURE__ */ h("path", { d: "M20 4 11 13" }), /* @__PURE__ */ h("path", { d: "M20 14v6H4V4h6" })),
  bolt: /* @__PURE__ */ h("path", { d: "m13 2-9 12h7l-1 8 10-12h-7z" }),
  info: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("circle", { cx: "12", cy: "12", r: "9" }), /* @__PURE__ */ h("path", { d: "M12 11v6M12 7v1" })),
  pulse: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("path", { d: "M3 12h4l2-6 3 12 2-6h5" })),
  eye: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("path", { d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" }), /* @__PURE__ */ h("circle", { cx: "12", cy: "12", r: "3" })),
  copy: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("rect", { x: "9", y: "9", width: "11", height: "11", rx: "2" }), /* @__PURE__ */ h("path", { d: "M5 15V5a2 2 0 0 1 2-2h8" })),
  key: /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("circle", { cx: "8", cy: "8", r: "4" }), /* @__PURE__ */ h("path", { d: "m11 11 9 9M17 17l2 2M14 20l2 2" }))
};
function Icon({ name, size = 18, ...props }) {
  return /* @__PURE__ */ h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...props }, ICONS[name] ?? ICONS.box);
}
function HubIcon({ size = 18, active: active2 = false, ...props }) {
  return /* @__PURE__ */ h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: active2 ? 1.9 : 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", ...props }, /* @__PURE__ */ h("circle", { cx: "12", cy: "12", r: "2.1" }), /* @__PURE__ */ h("path", { d: "M12 9.9V7.4M12 14.1v2.5M9.9 12H7.4M14.1 12h2.5" }), /* @__PURE__ */ h("circle", { cx: "12", cy: "5.2", r: "1.7" }), /* @__PURE__ */ h("circle", { cx: "12", cy: "18.8", r: "1.7" }), /* @__PURE__ */ h("circle", { cx: "5.2", cy: "12", r: "1.7" }), /* @__PURE__ */ h("circle", { cx: "18.8", cy: "12", r: "1.7" }));
}
function GitHubMark({ size = 15 }) {
  return /* @__PURE__ */ h("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true" }, /* @__PURE__ */ h("path", { d: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" }));
}
var blank = () => ({ transport: "stdio", command: "", args: [], env: {}, cwd: "", enabled: true });
var textError = (error) => error.message || "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5";
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function apiRequest(path, body, signal) {
  const response = await globalThis.fetch("api/dsh-mcp-hub" + path, { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : void 0, signal });
  if (!response.ok) {
    let message = "\u65E0\u6CD5\u8FDE\u63A5 MCP Hub\uFF0C\u8BF7\u786E\u8BA4 Host \u63D2\u4EF6\u5DF2\u542F\u7528";
    let code;
    try {
      const payload = await response.json();
      message = payload.error || message;
      code = payload.code;
    } catch {
    }
    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return response.json();
}
var Boundary = class extends import_react2.Component {
  constructor(props) {
    super(props);
    this.state = { error: void 0 };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return /* @__PURE__ */ h("div", { className: "hub-banner bad", role: "alert" }, /* @__PURE__ */ h(Icon, { name: "info" }), /* @__PURE__ */ h("span", null, "\u8FD9\u4E2A\u9762\u677F\u51FA\u9519\u4E86\uFF1A", this.state.error.message || "\u672A\u77E5\u9519\u8BEF"), /* @__PURE__ */ h("button", { className: "hub-text-button", onClick: () => this.setState({ error: void 0 }) }, "\u91CD\u8BD5"));
  }
};
function Badge({ children, tone = "" }) {
  return /* @__PURE__ */ h("span", { className: "hub-badge " + tone }, children);
}
function Status({ status = {} }) {
  const [label, tone] = STATUS2[status.state] ?? [`\u72B6\u6001\u672A\u77E5\uFF08${status.state ?? "\u65E0"}\uFF09`, "muted"];
  return /* @__PURE__ */ h("span", { className: "hub-status " + tone }, /* @__PURE__ */ h("i", null), label);
}
function StatusNote({ status = {}, verification }) {
  if (verification?.state === "verifying") return /* @__PURE__ */ h("span", { className: "hub-note warn", role: "status" }, /* @__PURE__ */ h("i", { className: "hub-spinner" }), verification.detail || "\u6B63\u5728\u9A8C\u8BC1\u8FDE\u63A5\u2026");
  if (verification?.state === "failed" && status.state !== "connected") return /* @__PURE__ */ h("span", { className: "hub-note bad", role: "alert" }, status.state === "disabled" ? "\u4E0A\u6B21\u9A8C\u8BC1\u672A\u901A\u8FC7\uFF1A" : "", verification.detail || "\u8FDE\u63A5\u9A8C\u8BC1\u672A\u901A\u8FC7");
  if (status.state === "reconnecting" && status.attempt != null) return /* @__PURE__ */ h("span", { className: "hub-note warn" }, "\u7B2C ", status.attempt, "/", status.maxAttempts ?? "?", " \u6B21\u91CD\u8BD5");
  if (status.state === "waiting-credentials") return /* @__PURE__ */ h("span", { className: "hub-note warn" }, "\u7F3A\u5C11 DSH \u51ED\u8BC1");
  if (status.cleanupError) return /* @__PURE__ */ h("span", { className: "hub-note bad", role: "alert" }, "\u6E05\u7406\u672A\u5B8C\u6210\uFF1A", status.cleanupError, "\uFF1B\u91CD\u542F DSH \u540E\u4F1A\u6E05\u9664");
  if (status.state === "failed" && status.reason) return /* @__PURE__ */ h("span", { className: "hub-note bad" }, REASON[status.reason] ?? status.reason);
  return null;
}
function IconButton({ icon, label, size = 18, className = "", ...props }) {
  return /* @__PURE__ */ h("button", { type: "button", className: "hub-icon-button " + className, title: label, "aria-label": label, ...props }, /* @__PURE__ */ h(Icon, { name: icon, size }));
}
function useDialog(onClose, busy = false) {
  const ref = (0, import_react2.useRef)(null), close = (0, import_react2.useRef)(onClose), pending = (0, import_react2.useRef)(busy);
  close.current = onClose;
  pending.current = busy;
  (0, import_react2.useEffect)(() => {
    const previous = document.activeElement;
    ref.current?.querySelector("button:not(:disabled),input:not(:disabled)")?.focus();
    const keydown = (event) => {
      if (event.key === "Escape" && !pending.current) {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const elements = [...ref.current.querySelectorAll("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)")];
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, []);
  return ref;
}
function ConfirmDialog({ title, description, confirmLabel, busy, error, onCancel, onConfirm }) {
  const ref = useDialog(onCancel, busy);
  return /* @__PURE__ */ h("div", { className: "hub-overlay" }, /* @__PURE__ */ h("section", { ref, className: "hub-dialog hub-confirm-dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "hub-confirm-title", "aria-describedby": "hub-confirm-description" }, /* @__PURE__ */ h("header", { className: "hub-dialog-header" }, /* @__PURE__ */ h("h2", { id: "hub-confirm-title" }, title), /* @__PURE__ */ h(IconButton, { icon: "close", label: "\u53D6\u6D88", disabled: busy, onClick: onCancel })), /* @__PURE__ */ h("div", { className: "hub-dialog-body" }, /* @__PURE__ */ h("p", { id: "hub-confirm-description" }, description), error && /* @__PURE__ */ h("div", { className: "hub-banner bad", role: "alert" }, error)), /* @__PURE__ */ h("footer", { className: "hub-dialog-footer" }, /* @__PURE__ */ h("div", { className: "hub-actions" }, /* @__PURE__ */ h("button", { className: "hub-button", onClick: onCancel, disabled: busy }, "\u53D6\u6D88"), /* @__PURE__ */ h("button", { className: "hub-button destructive", onClick: onConfirm, disabled: busy }, busy ? "\u5904\u7406\u4E2D\u2026" : confirmLabel)))));
}
function ExportDialog({ busy, error, onCancel, onExport }) {
  const ref = useDialog(onCancel, busy);
  const [includeSecrets, setIncludeSecrets] = (0, import_react2.useState)(false);
  return /* @__PURE__ */ h("div", { className: "hub-overlay" }, /* @__PURE__ */ h("section", { ref, className: "hub-dialog hub-export-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "hub-export-title", "aria-describedby": "hub-export-description" }, /* @__PURE__ */ h("header", { className: "hub-dialog-header" }, /* @__PURE__ */ h("h2", { id: "hub-export-title" }, "\u5BFC\u51FA\u914D\u7F6E"), /* @__PURE__ */ h(IconButton, { icon: "close", label: "\u53D6\u6D88", disabled: busy, onClick: onCancel })), /* @__PURE__ */ h("div", { className: "hub-dialog-body" }, /* @__PURE__ */ h("p", { id: "hub-export-description" }, "\u9009\u62E9\u662F\u5426\u628A\u5BC6\u94A5\u4E00\u8D77\u5BFC\u51FA\u3002"), /* @__PURE__ */ h("div", { className: "hub-export-options" }, /* @__PURE__ */ h("label", { className: "hub-export-option" }, /* @__PURE__ */ h("input", { type: "radio", name: "hub-export-secrets", checked: !includeSecrets, onChange: () => setIncludeSecrets(false), disabled: busy }), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("strong", null, "\u4E0D\u5305\u542B\u5BC6\u94A5"), /* @__PURE__ */ h("small", null, "\u9002\u5408\u5206\u4EAB\u7ED9\u4ED6\u4EBA\u6216\u505A\u901A\u7528\u5907\u4EFD\u3002\u51ED\u636E\u53EA\u4FDD\u7559 ${credential:\u2026} \u5F15\u7528\uFF0C\u6362\u4E00\u53F0\u673A\u5668\u540E\u9700\u8981\u914D\u7F6E\u540C\u540D\u51ED\u8BC1\u3002"))), /* @__PURE__ */ h("label", { className: "hub-export-option" }, /* @__PURE__ */ h("input", { type: "radio", name: "hub-export-secrets", checked: includeSecrets, onChange: () => setIncludeSecrets(true), disabled: busy }), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("strong", null, "\u540C\u65F6\u5BFC\u51FA\u5BC6\u94A5"), /* @__PURE__ */ h("small", null, "\u9002\u5408\u8FC1\u79FB\u5230\u81EA\u5DF1\u7684\u53E6\u4E00\u53F0\u7535\u8111\u3002\u5F15\u7528\u4F1A\u89E3\u6790\u4E3A\u5F53\u524D\u503C\u5E76\u4EE5\u660E\u6587\u5199\u5165 JSON\uFF0C\u8BF7\u53EA\u4FDD\u5B58\u5728\u53EF\u4FE1\u4F4D\u7F6E\uFF0C\u4E0D\u8981\u5206\u4EAB\u8FD9\u4EFD\u6587\u4EF6\u3002")))), includeSecrets && /* @__PURE__ */ h("div", { className: "hub-banner warn", role: "alert" }, /* @__PURE__ */ h(Icon, { name: "info" }), /* @__PURE__ */ h("span", null, "\u5BFC\u51FA\u6587\u4EF6\u5C06\u5305\u542B\u660E\u6587\u5BC6\u94A5\u3002\u53D1\u9001\u6216\u4E0A\u4F20\u524D\u8BF7\u786E\u8BA4\u63A5\u6536\u65B9\u53EF\u4FE1\u3002")), error && /* @__PURE__ */ h("div", { className: "hub-banner bad", role: "alert" }, error)), /* @__PURE__ */ h("footer", { className: "hub-dialog-footer" }, /* @__PURE__ */ h("div", { className: "hub-actions" }, /* @__PURE__ */ h("button", { className: "hub-button", onClick: onCancel, disabled: busy }, "\u53D6\u6D88"), /* @__PURE__ */ h("button", { className: "hub-button " + (includeSecrets ? "destructive" : "primary"), onClick: () => onExport(includeSecrets), disabled: busy }, busy ? "\u5BFC\u51FA\u4E2D\u2026" : includeSecrets ? "\u5BFC\u51FA\uFF08\u542B\u5BC6\u94A5\uFF09" : "\u5BFC\u51FA")))));
}
function DeleteDialog({ server, busy, error, onCancel, onDelete }) {
  return /* @__PURE__ */ h(
    ConfirmDialog,
    {
      title: "\u5220\u9664 MCP \u670D\u52A1\uFF1F",
      confirmLabel: "\u5220\u9664",
      busy,
      error,
      onCancel,
      onConfirm: onDelete,
      description: /* @__PURE__ */ h(import_react2.default.Fragment, null, "\u5C06\u4ECE DSH \u79FB\u9664 ", /* @__PURE__ */ h("strong", null, server.name), " \u7684\u914D\u7F6E\u5E76\u65AD\u5F00\u8FDE\u63A5\u3002")
    }
  );
}
function useRowIds() {
  const ids = (0, import_react2.useRef)(/* @__PURE__ */ new Map()), counter = (0, import_react2.useRef)(0);
  return (key) => {
    if (!ids.current.has(key)) ids.current.set(key, "r" + ++counter.current);
    return ids.current.get(key);
  };
}
async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
  } finally {
    area.remove();
  }
}
function Pairs({ value = {}, onChange, label, field, variables = [], onReveal, peeks = {}, onPeek, onCopy, onTestRenew, now = Date.now() }) {
  const [revealed, setRevealed] = (0, import_react2.useState)({}), [names, setNames] = (0, import_react2.useState)({}), [error, setError] = (0, import_react2.useState)("");
  const [copied, setCopied] = (0, import_react2.useState)(""), [editing, setEditing] = (0, import_react2.useState)(null);
  const [verified, setVerified] = (0, import_react2.useState)({});
  const idOf = useRowIds();
  const inputs = (0, import_react2.useRef)({});
  const [focusKey, setFocusKey] = (0, import_react2.useState)(null);
  (0, import_react2.useEffect)(() => {
    const node = focusKey ? inputs.current[focusKey] : null;
    if (!node) return;
    node.focus();
    setFocusKey(null);
  }, [focusKey]);
  const entries = Object.entries(value);
  const set = (key, val) => onChange({ ...value, [key]: val });
  async function show(key, val) {
    setError("");
    try {
      if (val.includes(MASK)) set(key, await onReveal(field, key));
      setRevealed((current) => ({ ...current, [key]: true }));
    } catch (error2) {
      setError(textError(error2));
    }
  }
  async function peekValue(key) {
    setError("");
    try {
      await onPeek(field, key);
    } catch (error2) {
      setError(textError(error2));
    }
  }
  async function copyValue(key) {
    setError("");
    try {
      const id = field + "/" + key;
      const value2 = peeks[id]?.value ?? await onCopy(field, key);
      if (typeof value2 !== "string") return;
      setCopied(id);
      setTimeout(() => setCopied((current) => current === id ? "" : current), 2e3);
    } catch (error2) {
      setError(textError(error2));
    }
  }
  async function rename(key, next) {
    setNames({});
    if (key === next) return;
    if (!next || Object.hasOwn(value, next)) {
      setError("\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A\u6216\u91CD\u590D");
      return;
    }
    try {
      const val = value[key].includes(MASK) ? await onReveal(field, key) : value[key];
      onChange(Object.fromEntries(entries.map(([k, v]) => [k === key ? next : k, k === key ? val : v])));
      setError("");
    } catch (error2) {
      setError(textError(error2));
    }
  }
  async function confirmRenew() {
    if (!editing || editing.busy || !editing.value.trim()) return;
    const { key: renewKey, value: next } = editing;
    setEditing((current) => current ? { ...current, busy: true, error: "" } : current);
    try {
      await onTestRenew(field, renewKey, next);
      set(renewKey, next);
      setVerified((current) => ({ ...current, [field + "/" + renewKey]: true }));
      setEditing(null);
    } catch (testError) {
      setEditing((current) => current ? { ...current, busy: false, error: textError(testError) } : current);
    }
  }
  return /* @__PURE__ */ h("div", { className: "hub-pairs" }, /* @__PURE__ */ h("div", { className: "hub-field-caption" }, label, /* @__PURE__ */ h("button", { type: "button", className: "hub-text-button", onClick: () => {
    let key = field === "headers" ? "Authorization" : "NEW_VARIABLE";
    while (Object.hasOwn(value, key)) key += "_";
    onChange({ ...value, [key]: "" });
  } }, "\uFF0B \u6DFB\u52A0\u4E00\u9879")), entries.map(([key, val], index) => {
    const ref = String(val).match(/^(Bearer\s+)?(?:\$\{(env:|credential:)?([^}]*)\}|\{env:([^}]*)\})$/i);
    const prefix = ref?.[1] ?? "";
    const defaultPrefix = field === "headers" && key.toLowerCase() === "authorization" ? "Bearer " : "";
    const kind = ref ? ref[2] === "credential:" ? "credential" : "env" : "literal";
    const shown = ref ? ref[3] ?? ref[4] : val;
    const info = variables.find((row) => row.field === field && row.key === key);
    const id = field + "/" + key, peek = peeks[id];
    const remaining = peek ? Math.max(0, Math.ceil((peek.until - now) / 1e3)) : 0;
    const copiedHere = copied === id;
    const secret = kind === "literal" && (isSecretKey(key) || /^(?:Bearer|Basic|Token)\s/i.test(String(val)));
    const verifiedHere = Boolean(verified[id]);
    const editingHere = editing?.key === key;
    return /* @__PURE__ */ h("div", { className: "hub-variable-row", key: idOf(key) }, /* @__PURE__ */ h("div", { className: "hub-pair" + (field === "env" ? " no-mode" : "") + (peek ? " peeking" : "") + (editingHere ? " editing" : "") }, /* @__PURE__ */ h("input", { "aria-label": label + "\u540D\u79F0 " + (index + 1), value: names[index] ?? key, placeholder: "KEY", readOnly: editingHere, onChange: (event) => setNames({ ...names, [index]: event.target.value }), onBlur: (event) => rename(key, event.target.value.trim()) }), field !== "env" && /* @__PURE__ */ h("select", { "aria-label": label + "\u914D\u7F6E\u65B9\u5F0F " + (index + 1), value: kind, disabled: editingHere, onChange: (event) => set(key, event.target.value === "literal" ? "" : event.target.value === "env" ? defaultPrefix + "${env:}" : defaultPrefix + "${credential:}") }, /* @__PURE__ */ h("option", { value: "literal" }, "\u76F4\u63A5\u586B\u5199"), /* @__PURE__ */ h("option", { value: "env" }, "\u73AF\u5883\u53D8\u91CF\u5F15\u7528"), /* @__PURE__ */ h("option", { value: "credential" }, "DSH \u51ED\u8BC1\u5F15\u7528")), editingHere ? /* @__PURE__ */ h("input", { "aria-label": label + "\u503C " + (index + 1), type: "password", autoFocus: true, autoComplete: "off", spellCheck: "false", value: editing.value, placeholder: "\u8F93\u5165\u65B0\u5BC6\u94A5", onChange: (event) => setEditing({ ...editing, value: event.target.value, error: "" }), onKeyDown: (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        confirmRenew();
      }
    } }) : peek ? /* @__PURE__ */ h("input", { "aria-label": label + "\u503C " + (index + 1), className: "hub-peeked", type: "text", readOnly: true, value: peek.value, onFocus: (event) => event.currentTarget.select() }) : /* @__PURE__ */ h("input", { "aria-label": label + "\u503C " + (index + 1), ref: (node) => {
      if (node) inputs.current[key] = node;
    }, readOnly: kind === "credential" || verifiedHere, type: (secret || verifiedHere) && !revealed[key] ? "password" : "text", value: verifiedHere ? String(val) : field === "env" ? typeof val === "string" ? val : "" : shown, placeholder: field === "env" ? "\u586B\u5199\u503C" : kind === "literal" ? "\u586B\u5199\u503C" : kind === "env" ? "\u4F8B\u5982 GITHUB_TOKEN" : "\u51ED\u8BC1\u540D\u79F0", autoComplete: "off", onChange: (event) => set(key, field === "env" ? event.target.value : kind === "literal" ? event.target.value : kind === "env" ? prefix + "${env:" + event.target.value + "}" : prefix + "${credential:" + event.target.value + "}") }), /* @__PURE__ */ h("span", { className: "hub-row-actions" }, editingHere ? /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h(IconButton, { icon: "check", label: "\u6D4B\u8BD5\u5E76\u4FDD\u5B58", disabled: editing.busy || !editing.value.trim(), onClick: confirmRenew }), /* @__PURE__ */ h(IconButton, { icon: "close", label: "\u53D6\u6D88\u7F16\u8F91", onClick: () => setEditing(null) })) : /* @__PURE__ */ h(import_react2.default.Fragment, null, kind === "credential" && /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h(IconButton, { icon: "eye", "aria-pressed": !!peek, label: peek ? "\u9690\u85CF\u5BC6\u94A5" : "\u663E\u793A\u5BC6\u94A5", onClick: () => peekValue(key) }), /* @__PURE__ */ h(IconButton, { icon: "copy", label: "\u590D\u5236\u5BC6\u94A5", onClick: () => copyValue(key) })), (kind === "credential" || secret) && /* @__PURE__ */ h(IconButton, { icon: "edit", label: "\u7F16\u8F91\u5BC6\u94A5", onClick: () => setEditing({ key, value: "", busy: false, error: "" }) }), secret && /* @__PURE__ */ h(IconButton, { icon: "eye", "aria-pressed": !!revealed[key], label: revealed[key] ? "\u9690\u85CF\u5BC6\u94A5" : "\u663E\u793A\u5BC6\u94A5", onClick: () => {
      if (revealed[key]) {
        setRevealed({ ...revealed, [key]: false });
        return;
      }
      if (String(val).includes(MASK)) {
        show(key, val);
        return;
      }
      setRevealed({ ...revealed, [key]: true });
    } }), /* @__PURE__ */ h(IconButton, { icon: "close", label: "\u79FB\u9664 " + key, onClick: () => onChange(Object.fromEntries(entries.filter(([k]) => k !== key))) })))), editingHere ? /* @__PURE__ */ h("small", { className: editing.error ? "bad" : "hub-help", role: editing.error ? "alert" : void 0 }, editing.error || (editing.busy ? "\u6B63\u5728\u6D4B\u8BD5\u8FDE\u63A5\u2026" : "\u6D4B\u8BD5\u901A\u8FC7\u540E\u624D\u4F1A\u5199\u5165\uFF1B\u5931\u8D25\u4FDD\u7559\u539F\u503C")) : /* @__PURE__ */ h("small", { className: info?.state === "missing" ? "bad" : "hub-help" }, peek ? /* @__PURE__ */ h(import_react2.default.Fragment, null, "\u5DF2\u663E\u793A\uFF0C\u5269 ", remaining, " \u79D2\u81EA\u52A8\u9690\u85CF", copiedHere ? " \xB7 \u5DF2\u590D\u5236" : "") : copiedHere ? "\u5DF2\u590D\u5236" : verifiedHere ? "\u65B0\u5BC6\u94A5\u5DF2\u901A\u8FC7\u6D4B\u8BD5\uFF0C\u4FDD\u5B58\u540E\u5199\u5165 DSH \u51ED\u8BC1" : info?.state === "missing" ? /* @__PURE__ */ h(import_react2.default.Fragment, null, "\u627E\u4E0D\u5230\u5F15\u7528\uFF1A", info.missing.join("\u3001"), "\uFF1B\u76F4\u63A5\u586B\u5199\u503C\u5373\u53EF\uFF0C\u4FDD\u5B58\u65F6\u5199\u5165 DSH \u51ED\u8BC1", /* @__PURE__ */ h("button", { type: "button", className: "hub-text-button", onClick: () => {
      set(key, "");
      setFocusKey(key);
    } }, "\u76F4\u63A5\u586B\u5199")) : info?.source ? "\u5DF2\u914D\u7F6E\uFF08\u6765\u81EA " + info.source + "\uFF09" : kind === "credential" ? "\u7531 DSH \u51ED\u8BC1\u670D\u52A1\u89E3\u6790\uFF0C\u8FDE\u63A5\u65F6\u9A8C\u8BC1" : field === "env" && secret ? "\u4FDD\u5B58\u540E\u5199\u5165 DSH \u51ED\u8BC1" : field === "env" ? "\u5F53\u524D\u662F\u5F15\u7528\uFF1B\u6539\u6210\u5177\u4F53\u503C\u4F1A\u5199\u5165 DSH \u51ED\u8BC1" : kind === "env" ? "\u4FDD\u5B58\u4E3A ${credential:\u2026} \u5F15\u7528\uFF0C\u8FDE\u63A5\u65F6\u4ECE DSH \u51ED\u8BC1\u670D\u52A1\u8BFB\u53D6" : secret ? "\u4FDD\u5B58\u540E\u5199\u5165 DSH \u51ED\u8BC1" : String(val).includes(MASK) ? "\u5DF2\u914D\u7F6E\uFF1B\u4FDD\u6301\u539F\u6837\u5C06\u4FDD\u7559\u539F\u503C" : val ? "\u5DF2\u586B\u5199" : "\u672A\u586B\u5199"));
  }), !entries.length && /* @__PURE__ */ h("p", { className: "hub-help" }, "\u6CA1\u6709\u989D\u5916\u7684", label, "\u3002"), error && /* @__PURE__ */ h("p", { className: "bad", role: "alert" }, error));
}
function Arguments({ value = [], onChange, onReveal }) {
  const [shown, setShown] = (0, import_react2.useState)({}), [error, setError] = (0, import_react2.useState)("");
  const idOf = useRowIds();
  const sensitive = (arg, index) => arg.includes(MASK) || /^-.*(?:token|password|secret|key|authorization)/i.test(arg) || /^-.*(?:token|password|secret|key|authorization)/i.test(value[index - 1] ?? "");
  async function reveal(index) {
    try {
      const next = [...value];
      if (next[index].includes(MASK)) next[index] = await onReveal("args", index);
      onChange(next);
      setShown({ ...shown, [index]: true });
    } catch (error2) {
      setError(textError(error2));
    }
  }
  async function remove(index) {
    try {
      const next = await Promise.all(value.map((arg, i) => arg.includes(MASK) ? onReveal("args", i) : arg));
      setShown({});
      onChange(next.filter((_, i) => i !== index));
    } catch (error2) {
      setError(textError(error2));
    }
  }
  return /* @__PURE__ */ h("div", { className: "hub-pairs" }, /* @__PURE__ */ h("div", { className: "hub-field-caption" }, "\u542F\u52A8\u53C2\u6570", /* @__PURE__ */ h("button", { type: "button", className: "hub-text-button", onClick: () => onChange([...value, ""]) }, "\uFF0B \u6DFB\u52A0\u53C2\u6570")), value.map((arg, index) => /* @__PURE__ */ h("div", { className: "hub-argument", key: idOf("a" + index) }, /* @__PURE__ */ h("span", null, index + 1), /* @__PURE__ */ h("input", { "aria-label": "\u542F\u52A8\u53C2\u6570 " + (index + 1), type: sensitive(arg, index) && !shown[index] ? "password" : "text", value: arg, spellCheck: "false", onChange: (event) => onChange(value.map((v, i) => i === index ? event.target.value : v)) }), sensitive(arg, index) && /* @__PURE__ */ h("button", { type: "button", className: "hub-text-button", onClick: () => shown[index] ? setShown({ ...shown, [index]: false }) : reveal(index) }, shown[index] ? "\u9690\u85CF" : "\u663E\u793A"), /* @__PURE__ */ h(IconButton, { icon: "close", label: "\u5220\u9664\u53C2\u6570 " + (index + 1), onClick: () => remove(index) }))), /* @__PURE__ */ h("p", { className: "hub-help" }, "\u6BCF\u9879\u662F\u4E00\u4E2A\u53C2\u6570\uFF0C\u7A7A\u683C\u548C\u7A7A\u53C2\u6570\u4F1A\u539F\u6837\u4FDD\u7559\uFF1B\u4EC5\u9690\u85CF\u7591\u4F3C\u51ED\u8BC1\u3002"), error && /* @__PURE__ */ h("p", { className: "bad", role: "alert" }, error));
}
function Checks({ checks, busy, testing }) {
  if (busy) return /* @__PURE__ */ h("div", { className: "hub-test-status testing", role: "status" }, /* @__PURE__ */ h("span", { className: "hub-test-icon" }, /* @__PURE__ */ h("span", { className: "hub-spinner" })), /* @__PURE__ */ h("div", { className: "hub-test-copy" }, /* @__PURE__ */ h("strong", null, testing ? "\u6B63\u5728\u6D4B\u8BD5\u8FDE\u63A5\u2026" : "\u6B63\u5728\u4FDD\u5B58\u2026"), testing && /* @__PURE__ */ h("p", null, "\u542F\u52A8\u670D\u52A1\u5E76\u5B8C\u6210\u63E1\u624B")));
  if (!checks?.length) return null;
  const failed = checks.filter((check) => !check.ok);
  const hard = failed.find((check) => check.hard);
  const connection = failed.find((check) => check.label === "MCP \u8FDE\u63A5" || check.label === "MCP \u8FDE\u63A5\u6D4B\u8BD5");
  const capability = failed.find((check) => check.label === "\u5DE5\u5177\u53D1\u73B0");
  const cleanup = failed.find((check) => check.label === "\u6D4B\u8BD5\u8FDE\u63A5\u5DF2\u5173\u95ED");
  const concise = (text, max = 170) => {
    const value = String(text ?? "").replace(/\s+/g, " ").trim();
    return value.length > max ? value.slice(0, max - 1) + "\u2026" : value;
  };
  let tone = "bad", title = "\u914D\u7F6E\u68C0\u67E5\u672A\u901A\u8FC7", detail = "";
  if (!failed.length) {
    tone = "good";
    title = "\u8FDE\u63A5\u6B63\u5E38";
    detail = checks.find((check) => check.label === "\u5DE5\u5177\u53D1\u73B0")?.detail ?? "\u670D\u52A1\u53EF\u7528\uFF0C\u53EF\u4EE5\u6DFB\u52A0";
  } else if (hard) {
    detail = `${hard.label}\uFF1A${hard.detail}`;
  } else if (connection) {
    title = "\u8FDE\u63A5\u5931\u8D25";
    detail = connection.detail;
  } else if (capability) {
    tone = "warn";
    title = "\u5DF2\u8FDE\u63A5\uFF0C\u4F46\u5DE5\u5177\u53D1\u73B0\u5931\u8D25";
    detail = capability.detail;
  } else if (cleanup) {
    tone = "warn";
    title = "\u8FDE\u63A5\u5DF2\u5EFA\u7ACB\uFF0C\u4F46\u6D4B\u8BD5\u8FDB\u7A0B\u672A\u6E05\u7406";
    detail = cleanup.detail;
  } else {
    detail = `${failed[0].label}\uFF1A${failed[0].detail}`;
  }
  return /* @__PURE__ */ h("div", { className: "hub-test-status " + tone, role: tone === "bad" ? "alert" : "status" }, /* @__PURE__ */ h("span", { className: "hub-test-icon" }, /* @__PURE__ */ h(Icon, { name: tone === "good" ? "check" : "info", size: 16 })), /* @__PURE__ */ h("div", { className: "hub-test-copy" }, /* @__PURE__ */ h("strong", null, title), detail && /* @__PURE__ */ h("p", null, concise(detail)), tone !== "good" && /* @__PURE__ */ h("details", { className: "hub-test-details" }, /* @__PURE__ */ h("summary", null, "\u67E5\u770B\u68C0\u67E5\u8BE6\u60C5"), /* @__PURE__ */ h("div", { className: "hub-check-list" }, checks.map((check, i) => /* @__PURE__ */ h("div", { className: "hub-check " + (check.ok ? "good" : "bad"), key: i }, /* @__PURE__ */ h("span", { className: "hub-check-symbol" }, check.ok ? "\u2713" : "!"), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("strong", null, check.label), /* @__PURE__ */ h("p", null, check.detail))))))));
}
var NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
var rowKey = (row) => row.path?.length ? row.path.join("\0") : "$direct";
var rowSignature = (row) => JSON.stringify({ name: row.name, entry: row.entry });
var JSON_FORMATTING = { formattingOptions: { insertSpaces: true, tabSize: 2 } };
var resultState = (result) => {
  if (!result) return "untested";
  if (result.error) return "failed";
  const connected = result.connectionOk ?? result.ok;
  const cleanup = result.cleanupOk ?? result.ok;
  if (!connected || !cleanup) return "failed";
  return result.capability === "failed" ? "warn" : "passed";
};
var resultDetail = (result) => {
  if (result?.error) return result.error;
  if (!result) return "";
  const failed = (result.checks ?? []).find((check) => !check.ok);
  return failed?.detail ?? (result.capability === "failed" ? "\u670D\u52A1\u5DF2\u8FDE\u63A5\uFF0C\u4F46\u5DE5\u5177\u5217\u8868\u83B7\u53D6\u5931\u8D25\uFF1B\u6DFB\u52A0\u540E\u4F1A\u518D\u6B21\u9A8C\u8BC1\u3002" : "\u6D4B\u8BD5\u901A\u8FC7\uFF0C\u53EF\u4EE5\u6DFB\u52A0\u3002");
};
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
function Editor({ draft, request, revision, reloadRevision, onClose, onSaved, existing = [] }) {
  const [formName, setFormName] = (0, import_react2.useState)(draft.name ?? "");
  const [formAuth, setFormAuth] = (0, import_react2.useState)(draft.auth ?? "token");
  const [formEntry, setFormEntry] = (0, import_react2.useState)(() => structuredClone(draft.entry ?? blank()));
  const [formChecks, setFormChecks] = (0, import_react2.useState)([]);
  const [formVariables, setFormVariables] = (0, import_react2.useState)([]);
  const [formAccept, setFormAccept] = (0, import_react2.useState)(false);
  const [jsonText, setJsonText] = (0, import_react2.useState)(() => draft.jsonText ?? (draft.originalName || draft.candidateId ? JSON.stringify(draft.entry ?? blank(), null, 2) : ""));
  const [jsonFormat, setJsonFormat] = (0, import_react2.useState)(draft.jsonFormat ?? "jsonc");
  const [jsonRows, setJsonRows] = (0, import_react2.useState)([]);
  const [jsonDirectName, setJsonDirectName] = (0, import_react2.useState)(draft.name ?? "");
  const [jsonError, setJsonError] = (0, import_react2.useState)("");
  const [jsonBatchError, setJsonBatchError] = (0, import_react2.useState)("");
  const [jsonChecks, setJsonChecks] = (0, import_react2.useState)([]);
  const [tests, setTests] = (0, import_react2.useState)({});
  const [accepted, setAccepted] = (0, import_react2.useState)({});
  const [mode, setMode] = (0, import_react2.useState)(draft.initialMode ?? (draft.originalName || draft.candidateId ? "form" : "json"));
  const [peeks, setPeeks] = (0, import_react2.useState)({}), [peekClock, setPeekClock] = (0, import_react2.useState)(0);
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [testingAll, setTestingAll] = (0, import_react2.useState)(false);
  const [testingRow, setTestingRow] = (0, import_react2.useState)("");
  const [progress, setProgress] = (0, import_react2.useState)({ done: 0, total: 0 });
  const [reading, setReading] = (0, import_react2.useState)(0);
  const [busyAction, setBusyAction] = (0, import_react2.useState)("");
  const [error, setError] = (0, import_react2.useState)("");
  const [stale, setStale] = (0, import_react2.useState)(false);
  const [saved, setSaved] = (0, import_react2.useState)(false);
  const [warnings, setWarnings] = (0, import_react2.useState)([]);
  const [willWrite, setWillWrite] = (0, import_react2.useState)(null);
  const transportDrafts = (0, import_react2.useRef)({});
  const originalName = (0, import_react2.useRef)(draft.originalName);
  const currentRevision = (0, import_react2.useRef)(revision);
  const dialog = (0, import_react2.useRef)(null);
  const onCloseRef = (0, import_react2.useRef)(onClose);
  const askCloseRef = (0, import_react2.useRef)(null);
  const busyRef = (0, import_react2.useRef)(false);
  const abortRef = (0, import_react2.useRef)(null);
  const initialForm = (0, import_react2.useRef)(JSON.stringify({ name: formName, entry: formEntry }));
  const initialJson = (0, import_react2.useRef)(jsonText);
  onCloseRef.current = onClose;
  const formDirty = JSON.stringify({ name: formName, entry: formEntry }) !== initialForm.current;
  const jsonDirty = jsonText !== initialJson.current;
  const closeEditor = () => {
    if (busyRef.current) return;
    onCloseRef.current?.();
  };
  askCloseRef.current = closeEditor;
  busyRef.current = busy || reading > 0 || testingAll;
  (0, import_react2.useEffect)(() => {
    const previous = document.activeElement;
    const root = dialog.current;
    root?.querySelector("input,button")?.focus();
    const listener = (event) => {
      if (event.key === "Escape" && !busyRef.current) askCloseRef.current?.();
      if (event.key !== "Tab" || !root) return;
      const focusable = [...root.querySelectorAll("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]")];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, []);
  (0, import_react2.useEffect)(() => () => {
    abortRef.current?.abort();
  }, []);
  (0, import_react2.useEffect)(() => {
    if (mode !== "json") return;
    setJsonBatchError("");
    if (!jsonText.trim()) {
      setJsonRows([]);
      setJsonError("");
      return;
    }
    const timer = setTimeout(() => {
      try {
        const rows = parseEditorDocument(jsonText, originalName.current || jsonDirectName, jsonFormat === "toml" ? "paste.toml" : "paste.jsonc");
        setJsonRows(rows);
        setJsonError("");
      } catch (parseError) {
        setJsonRows([]);
        setJsonError(textError(parseError));
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [jsonText, mode, jsonFormat, jsonDirectName]);
  const existingSet = new Set(existing ?? []);
  const original = originalName.current;
  const duplicateName = (value) => Boolean(value) && value !== original && existingSet.has(value);
  const nameMessage = (value, duplicate) => {
    if (!value) return "\u8BF7\u586B\u5199\u670D\u52A1\u540D\u79F0";
    if (!NAME_RE.test(value)) return "\u540D\u79F0\u53EA\u80FD\u5305\u542B\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u8FDE\u5B57\u7B26\uFF0C1\u201332 \u4F4D";
    if (duplicate) return "\u5DF2\u5B58\u5728\u540C\u540D\u670D\u52A1\uFF1B\u8BF7\u4FEE\u6539\u540D\u79F0\u540E\u91CD\u8BD5";
    return "";
  };
  const formNameValue = formName.trim();
  const formDuplicate = duplicateName(formNameValue);
  const formNameError = formName ? nameMessage(formNameValue, formDuplicate) : "";
  const editorIssues = draft.issues ?? [];
  const formIssues = [...new Set(editorIssues)];
  const formReady = Boolean(formNameValue) && !formNameError && (!formIssues.length || formAccept);
  const formCheckReady = Boolean(formNameValue) && !nameMessage(formNameValue, false);
  const counts = /* @__PURE__ */ new Map();
  for (const row of jsonRows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  const invalidRow = (row) => Boolean(row.invalid || !row.name?.trim() || !row.entry?.transport);
  const conflictRow = (row) => (counts.get(row.name) ?? 0) > 1;
  const rowIssues = (row) => [.../* @__PURE__ */ new Set([...row.issues ?? [], ...jsonRows.length === 1 ? editorIssues : []])];
  const jsonSkipped = jsonRows.filter((row) => !invalidRow(row) && duplicateName(row.name) && !conflictRow(row));
  const jsonConflicts = jsonRows.filter((row) => !invalidRow(row) && conflictRow(row));
  const jsonAddRows = jsonRows.filter((row) => !invalidRow(row) && !duplicateName(row.name) && !conflictRow(row));
  const jsonNeedsReview = jsonAddRows.filter((row) => rowIssues(row).length && !accepted[rowKey(row)]);
  const jsonInvalid = jsonRows.filter(invalidRow);
  const recordFor = (row) => {
    const record = tests[rowKey(row)];
    return record && record.signature === rowSignature(row) ? record : null;
  };
  const stateFor = (row) => {
    const record = recordFor(row);
    if (!record) return "untested";
    if (record.error) return "failed";
    return resultState(record.result);
  };
  const canTest = (row) => !invalidRow(row) && !duplicateName(row.name) && !conflictRow(row) && (!rowIssues(row).length || Boolean(accepted[rowKey(row)]));
  const rowReady = (row) => canTest(row) && ["passed", "warn"].includes(stateFor(row));
  const directUnnamed = !original && jsonRows.length === 1 && jsonRows[0].direct && !jsonRows[0].raw?.name && !jsonRows[0].raw?.serverName;
  const jsonDirectNameError = directUnnamed && jsonDirectName && !NAME_RE.test(jsonDirectName) ? "\u540D\u79F0\u53EA\u80FD\u5305\u542B\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u8FDE\u5B57\u7B26\uFF0C1\u201332 \u4F4D" : "";
  const jsonReady = !original && jsonRows.length > 0 && !jsonInvalid.length && !jsonConflicts.length && jsonAddRows.length > 0 && jsonAddRows.every(rowReady) && !jsonError && !jsonDirectNameError;
  const jsonEditRow = original && jsonRows.length === 1 ? jsonRows[0] : null;
  const jsonEditReady = Boolean(jsonEditRow) && !invalidRow(jsonEditRow) && !duplicateName(jsonEditRow.name) && !conflictRow(jsonEditRow) && (!rowIssues(jsonEditRow).length || Boolean(accepted[rowKey(jsonEditRow)])) && !jsonError;
  const jsonCandidateId = draft.candidateId && jsonRows.length === 1 ? draft.candidateId : void 0;
  const edit = (key, value) => {
    setFormEntry((current) => ({ ...current, [key]: value }));
    setFormChecks([]);
    setFormVariables([]);
    setError("");
    setSaved(false);
  };
  const editName = (value) => {
    setFormName(value);
    setFormChecks([]);
    setError("");
    setSaved(false);
  };
  function runRowTest(row, signal) {
    const key = rowKey(row);
    return request("/test", {
      name: row.name.trim(),
      entry: row.entry,
      candidateId: jsonCandidateId,
      acceptUnsupported: Boolean(accepted[key])
    }, signal).then((result) => {
      if (!signal?.aborted) setTests((current) => ({ ...current, [key]: { signature: rowSignature(row), result } }));
      return result;
    }).catch((testError) => {
      if (!signal?.aborted) setTests((current) => ({ ...current, [key]: { signature: rowSignature(row), error: textError(testError) } }));
      return null;
    });
  }
  async function testRow(row) {
    if (!canTest(row)) return;
    setTestingRow(rowKey(row));
    setError("");
    try {
      await runRowTest(row);
    } finally {
      setTestingRow("");
    }
  }
  async function testAll() {
    const queue = jsonAddRows.filter(canTest);
    if (!queue.length) {
      setJsonBatchError("\u6CA1\u6709\u53EF\u4EE5\u6D4B\u8BD5\u7684\u670D\u52A1\uFF1B\u8BF7\u5148\u5904\u7406\u65E0\u6CD5\u89E3\u6790\u3001\u91CD\u540D\u6216\u9700\u8981\u6838\u5BF9\u7684\u914D\u7F6E\u3002");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setTestingAll(true);
    setProgress({ done: 0, total: queue.length });
    setJsonBatchError("");
    setError("");
    let cursor = 0;
    const worker = async () => {
      for (; ; ) {
        const index = cursor++;
        if (index >= queue.length || controller.signal.aborted) return;
        await runRowTest(queue[index], controller.signal);
        if (!controller.signal.aborted) setProgress((current) => ({ ...current, done: Math.min(current.done + 1, current.total) }));
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
    } finally {
      setTestingAll(false);
      abortRef.current = null;
    }
  }
  function cancelTests() {
    abortRef.current?.abort();
    abortRef.current = null;
    setTestingAll(false);
    setTestingRow("");
    setJsonBatchError("\u5DF2\u53D6\u6D88\u6D4B\u8BD5\uFF1B\u5DF2\u5B8C\u6210\u7684\u6D4B\u8BD5\u7ED3\u679C\u4F1A\u4FDD\u7559\u3002");
  }
  function removeRow(row) {
    setJsonBatchError("");
    if (!row.path?.length || jsonFormat !== "jsonc") {
      setJsonBatchError("\u8FD9\u4E2A\u914D\u7F6E\u65E0\u6CD5\u5728\u884C\u5185\u5220\u9664\uFF0C\u8BF7\u5728\u6587\u672C\u4E2D\u5220\u9664\u5B83\u3002");
      return;
    }
    try {
      const next = applyEdits(jsonText, modify(jsonText, row.path, void 0, JSON_FORMATTING));
      setJsonText(next);
      setTests((current) => {
        const copy2 = { ...current };
        delete copy2[rowKey(row)];
        return copy2;
      });
    } catch (removeError) {
      setJsonBatchError(textError(removeError));
    }
  }
  function acceptRow(row, value) {
    setAccepted((current) => ({ ...current, [rowKey(row)]: value }));
  }
  async function submitForm(action) {
    setError("");
    setStale(false);
    setWarnings([]);
    setFormChecks([]);
    if (action === "check" && !formCheckReady) {
      setError(formNameError || "\u8BF7\u5148\u586B\u5199\u5408\u6CD5\u7684\u670D\u52A1\u540D\u79F0");
      return;
    }
    if (action !== "check" && !formReady) {
      setError(formNameError || (formIssues.length && !formAccept ? "\u8BF7\u5148\u6838\u5BF9\u5E76\u786E\u8BA4\u4E0D\u8FC1\u79FB\u7684\u914D\u7F6E\u5B57\u6BB5" : "\u8BF7\u5148\u8865\u5168\u914D\u7F6E"));
      return;
    }
    setBusy(true);
    setBusyAction(action);
    try {
      const body = {
        action: action === "check" ? "check" : "save",
        name: formNameValue,
        // New services are always enabled; enabled:false in a pasted config is a
        // leftover from another app, not a choice made here. Editing keeps the row's state.
        entry: original ? formEntry : { ...formEntry, enabled: true },
        candidateId: original ? void 0 : draft.candidateId,
        originalName: original,
        revision: currentRevision.current,
        acceptUnsupported: formAccept,
        auth: formAuth,
        mode: original && formEntry.enabled === false ? "draft" : void 0
      };
      const result = await retryWhileCleaning(() => request(action === "check" ? "/test" : "/mutate", body));
      if (result.entry) setWillWrite(result.entry);
      setFormChecks(result.checks ?? []);
      setFormVariables(result.variables ?? []);
      if (action === "check") return;
      setWarnings(result.warnings ?? []);
      if (result.saved) {
        setSaved(true);
        originalName.current = formNameValue;
        const latest = await onSaved({ result, names: [formNameValue], batch: false });
        if (latest?.revision !== void 0) currentRevision.current = latest.revision;
      } else {
        setError("\u4FDD\u5B58\u672A\u5B8C\u6210\uFF0C\u8BF7\u67E5\u770B\u4E0B\u65B9\u7684\u68C0\u67E5\u7ED3\u679C\u3002");
      }
      if (result.saved && !result.ok && !result.draft) setError("\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u8FDE\u63A5\u9A8C\u8BC1\u672A\u901A\u8FC7\u3002\u8BF7\u8865\u5168\u540E\u91CD\u8BD5\uFF1B\u53EF\u5728\u5DF2\u6DFB\u52A0\u5217\u8868\u67E5\u770B\u72B6\u6001\u3002");
    } catch (submitError) {
      setError(textError(submitError));
      if (submitError.code === "REVISION_CONFLICT") setStale(true);
    } finally {
      setBusy(false);
      setBusyAction("");
    }
  }
  async function submitJson() {
    setError("");
    setJsonBatchError("");
    setStale(false);
    setWarnings([]);
    setJsonChecks([]);
    if (jsonError) {
      setError("JSON \u8FD8\u4E0D\u80FD\u89E3\u6790\uFF0C\u8BF7\u5148\u4FEE\u6B63\u6587\u672C\u4E2D\u7684\u9519\u8BEF\u3002");
      return;
    }
    if (original) {
      if (!jsonEditReady) {
        setError(jsonRows.length !== 1 ? "\u7F16\u8F91\u6A21\u5F0F\u9700\u8981\u5728 JSON \u4E2D\u53EA\u4FDD\u7559\u4E00\u4E2A\u670D\u52A1\u914D\u7F6E" : "\u8BF7\u5148\u5904\u7406\u91CD\u540D\u6216\u9700\u8981\u6838\u5BF9\u7684\u914D\u7F6E\u5B57\u6BB5");
        return;
      }
      const row = jsonEditRow;
      setBusy(true);
      setBusyAction("save");
      try {
        const result = await retryWhileCleaning(() => request("/mutate", {
          action: "save",
          name: row.name.trim(),
          entry: row.entry,
          originalName: original,
          revision: currentRevision.current,
          acceptUnsupported: Boolean(accepted[rowKey(row)]),
          mode: row.entry.enabled === false ? "draft" : void 0
        }));
        if (result.entry) setWillWrite(result.entry);
        setJsonChecks(result.checks ?? []);
        setWarnings(result.warnings ?? []);
        if (result.saved) {
          setSaved(true);
          originalName.current = row.name.trim();
          const latest = await onSaved({ result, names: [row.name.trim()], batch: false });
          if (latest?.revision !== void 0) currentRevision.current = latest.revision;
        } else setError("\u4FDD\u5B58\u672A\u5B8C\u6210\uFF0C\u8BF7\u67E5\u770B\u4E0B\u65B9\u7684\u68C0\u67E5\u7ED3\u679C\u3002");
        if (result.saved && !result.ok && !result.draft) setError("\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u8FDE\u63A5\u9A8C\u8BC1\u672A\u901A\u8FC7\u3002\u8BF7\u8865\u5168\u540E\u91CD\u8BD5\uFF1B\u53EF\u5728\u5DF2\u6DFB\u52A0\u5217\u8868\u67E5\u770B\u72B6\u6001\u3002");
      } catch (submitError) {
        setError(textError(submitError));
        if (submitError.code === "REVISION_CONFLICT") setStale(true);
      } finally {
        setBusy(false);
        setBusyAction("");
      }
      return;
    }
    if (!jsonReady) {
      if (jsonInvalid.length) setJsonBatchError("\u6709\u670D\u52A1\u65E0\u6CD5\u89E3\u6790\uFF0C\u8BF7\u4FEE\u6B63\u6216\u5220\u9664\u8FD9\u4E9B\u884C\u540E\u518D\u6DFB\u52A0\u3002");
      else if (jsonConflicts.length) setJsonBatchError("\u6709\u670D\u52A1\u91CD\u540D\uFF0C\u8BF7\u4FEE\u6539\u540D\u79F0\u6216\u5220\u9664\u91CD\u590D\u884C\u3002");
      else if (jsonNeedsReview.length) setJsonBatchError("\u6709\u914D\u7F6E\u9700\u8981\u6838\u5BF9\uFF0C\u8BF7\u9010\u884C\u786E\u8BA4\u540E\u518D\u6DFB\u52A0\u3002");
      else if (jsonAddRows.length) setJsonBatchError("\u8BF7\u5148\u8BA9\u6240\u6709\u5F85\u6DFB\u52A0\u670D\u52A1\u901A\u8FC7\u8FDE\u63A5\u6D4B\u8BD5\u3002");
      else setJsonBatchError("\u6CA1\u6709\u53EF\u6DFB\u52A0\u7684\u670D\u52A1\u3002\u5DF2\u5B58\u5728\u7684\u670D\u52A1\u4F1A\u8DF3\u8FC7\uFF1B\u5982\u9700\u65B0\u589E\uFF0C\u8BF7\u4FEE\u6539\u540D\u79F0\u3002");
      return;
    }
    const entries = jsonAddRows.map((row) => ({
      name: row.name.trim(),
      entry: row.entry,
      candidateId: jsonCandidateId,
      acceptUnsupported: Boolean(accepted[rowKey(row)])
    }));
    setBusy(true);
    setBusyAction("import");
    try {
      const result = await retryWhileCleaning(() => request("/mutate", { action: "import", revision: currentRevision.current, entries }));
      setJsonChecks(result.checks ?? []);
      setWarnings(result.warnings ?? []);
      if (result.ok && result.saved) {
        setSaved(true);
        const names = result.imported ?? jsonAddRows.map((row) => row.name.trim());
        const latest = await onSaved({ result, names, batch: true });
        if (latest?.revision !== void 0) currentRevision.current = latest.revision;
      } else if (result.ok) {
        setJsonBatchError("\u6CA1\u6709\u65B0\u7684\u670D\u52A1\u9700\u8981\u6DFB\u52A0\uFF1B\u5DF2\u5B58\u5728\u7684\u670D\u52A1\u4F1A\u88AB\u8DF3\u8FC7\u3002");
      } else if (result.failed) {
        setJsonBatchError(`\u670D\u52A1\u300C${result.failed.name}\u300D\u672A\u901A\u8FC7\u6821\u9A8C\uFF0C\u672C\u6B21\u6CA1\u6709\u5199\u5165\u4EFB\u4F55\u914D\u7F6E\u3002`);
      } else {
        setJsonBatchError("\u672C\u6B21\u6CA1\u6709\u5199\u5165\u4EFB\u4F55\u914D\u7F6E\uFF0C\u8BF7\u68C0\u67E5\u6D4B\u8BD5\u7ED3\u679C\u548C\u914D\u7F6E\u3002");
      }
    } catch (submitError) {
      setError(textError(submitError));
      if (submitError.code === "REVISION_CONFLICT") setStale(true);
    } finally {
      setBusy(false);
      setBusyAction("");
    }
  }
  async function resync() {
    try {
      const latest = await reloadRevision();
      currentRevision.current = latest;
      setStale(false);
      setError("\u5DF2\u540C\u6B65\u5230\u6700\u65B0\u7248\u672C\uFF0C\u8BF7\u518D\u6B21\u70B9\u51FB\u4FDD\u5B58");
    } catch (resyncError) {
      setError(textError(resyncError));
    }
  }
  async function reveal(field, key) {
    setReading((count) => count + 1);
    try {
      const result = await request("/reveal", { field, key, originalName: original, candidateId: original ? void 0 : draft.candidateId });
      return result.value;
    } finally {
      setReading((count) => count - 1);
    }
  }
  async function peek(field, key) {
    const id = field + "/" + key;
    if (peeks[id]) {
      setPeeks({});
      return;
    }
    const value = await reveal(field, key);
    if (typeof value !== "string") return;
    setPeeks({ [id]: { value, until: Date.now() + 1e4 } });
  }
  async function copy(field, key) {
    const value = await reveal(field, key);
    if (typeof value !== "string") return void 0;
    await writeClipboard(value);
    return value;
  }
  async function testRenew(field, key, next) {
    const entry = { ...formEntry, [field]: { ...formEntry[field] ?? {}, [key]: next } };
    setReading((count) => count + 1);
    try {
      const result = await request("/test", {
        name: formName.trim(),
        entry,
        candidateId: original ? void 0 : draft.candidateId,
        acceptUnsupported: true
      });
      if (result?.ok) return true;
      const failed = Array.isArray(result?.checks) ? result.checks.find((check) => !check.ok) : null;
      throw new Error(failed?.detail || "\u8FDE\u63A5\u6D4B\u8BD5\u672A\u901A\u8FC7");
    } finally {
      setReading((count) => count - 1);
    }
  }
  (0, import_react2.useEffect)(() => {
    if (!Object.keys(peeks).length) return void 0;
    const timer = setInterval(() => setPeekClock(Date.now()), 250);
    return () => clearInterval(timer);
  }, [peeks]);
  (0, import_react2.useEffect)(() => {
    if (!Object.keys(peeks).length) return;
    if (Object.values(peeks).some((entry) => entry.until <= Date.now())) setPeeks({});
  }, [peekClock]);
  const transport = formEntry.transport;
  const jsonPassed = jsonAddRows.filter(rowReady).length;
  const jsonSummary = [
    `\u5DF2\u8BC6\u522B ${jsonRows.length} \u4E2A\u670D\u52A1`,
    jsonAddRows.length ? `\u5F85\u6DFB\u52A0 ${jsonAddRows.length}` : "",
    jsonSkipped.length ? `\u5DF2\u5B58\u5728\u8DF3\u8FC7 ${jsonSkipped.length}` : "",
    jsonConflicts.length ? `\u91CD\u540D\u51B2\u7A81 ${jsonConflicts.length}` : "",
    jsonInvalid.length ? `\u65E0\u6CD5\u89E3\u6790 ${jsonInvalid.length}` : "",
    jsonNeedsReview.length ? `\u9700\u6838\u5BF9 ${jsonNeedsReview.length}` : ""
  ].filter(Boolean).join(" \xB7 ");
  const jsonPlaceholder = jsonFormat === "toml" ? '[mcp_servers.context7]\ncommand = "npx"\nargs = ["-y", "@upstash/context7-mcp"]' : '{\n  "mcpServers": {\n    "\u670D\u52A1\u540D": { "command": "npx", "args": ["-y", "some-mcp"] }\n  }\n}';
  const jsonHelp = original ? "\u7F16\u8F91\u6A21\u5F0F\u53EA\u4FDD\u5B58\u5F53\u524D\u8FD9\u4E00\u4E2A\u670D\u52A1\uFF1BJSON \u4E0E\u8868\u5355\u5404\u81EA\u4FDD\u7559\u4FEE\u6539\uFF0C\u5207\u6362\u9875\u7B7E\u4E0D\u4F1A\u8986\u76D6\u3002" : jsonRows.length ? "\u5F85\u6DFB\u52A0\u670D\u52A1\u5FC5\u987B\u5168\u90E8\u6D4B\u8BD5\u901A\u8FC7\uFF1B\u5DF2\u5B58\u5728\u7684\u540C\u540D\u670D\u52A1\u4F1A\u8DF3\u8FC7\uFF0C\u4FEE\u6539\u6587\u672C\u4E2D\u7684\u670D\u52A1\u540D\u540E\u53EF\u4F5C\u4E3A\u65B0\u670D\u52A1\u91CD\u6D4B\u3002" : "\u7C98\u8D34\u4E00\u4E2A\u6216\u591A\u4E2A\u670D\u52A1\u914D\u7F6E\uFF1B\u652F\u6301 JSON\u3001JSONC\u3001TOML \u548C mcpServers \u5BB9\u5668\u683C\u5F0F\u3002";
  return /* @__PURE__ */ h("div", { className: "hub-overlay" }, /* @__PURE__ */ h("section", { ref: dialog, className: "hub-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "hub-editor-title" }, /* @__PURE__ */ h("header", { className: "hub-dialog-header" }, /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h2", { id: "hub-editor-title" }, draft.originalName ? "\u7F16\u8F91 MCP \u670D\u52A1" : "\u6DFB\u52A0 MCP \u670D\u52A1")), /* @__PURE__ */ h(IconButton, { icon: "close", label: "\u5173\u95ED\u914D\u7F6E\u7A97\u53E3", onClick: closeEditor, disabled: busy || reading > 0 || testingAll })), /* @__PURE__ */ h("div", { className: "hub-dialog-body" }, draft.source && /* @__PURE__ */ h("div", { className: "hub-source-note" }, /* @__PURE__ */ h(Icon, { name: "import" }), /* @__PURE__ */ h("div", null, "\u4ECE ", draft.source, " \u5BFC\u5165", /* @__PURE__ */ h("code", { title: draft.sourcePath }, draft.sourcePath), /* @__PURE__ */ h("small", null, draft.detail ? "\u9879\u76EE\u7EA7\u914D\u7F6E \xB7 " + draft.detail : "\u914D\u7F6E\u590D\u5236\u5230 DSH \u540E\u72EC\u7ACB\u7BA1\u7406"))), willWrite && (() => {
    const rows = draft.sourcePath ? diffRows(draft.entry ?? {}, willWrite) : [];
    return /* @__PURE__ */ h("details", { className: "hub-willwrite" }, /* @__PURE__ */ h("summary", null, rows.length ? `\u5C06\u5199\u5165 DSH \u7684\u914D\u7F6E\uFF08${rows.length} \u5904\u4E0E\u6765\u6E90\u4E0D\u540C\uFF09` : "\u5C06\u5199\u5165 DSH \u7684\u914D\u7F6E"), rows.length > 0 && /* @__PURE__ */ h("ul", null, rows.slice(0, 12).map((row) => /* @__PURE__ */ h("li", { key: row.path }, /* @__PURE__ */ h("code", null, row.path), /* @__PURE__ */ h("span", null, showValue(row.from), " \u2192 ", showValue(row.to))))), rows.length > 12 && /* @__PURE__ */ h("p", { className: "hub-help" }, "\u53E6\u6709 ", rows.length - 12, " \u5904\u5DEE\u5F02\uFF0C\u89C1\u4E0B\u65B9\u5B8C\u6574\u914D\u7F6E\u3002"), /* @__PURE__ */ h("pre", null, JSON.stringify(willWrite, null, 2)), /* @__PURE__ */ h("p", { className: "hub-help" }, "\u51ED\u636E\u6309\u5B57\u6BB5\u540D\u906E\u853D\uFF1B\u5F15\u7528\u4FDD\u5B58\u4E3A ${credential:\u2026}\uFF0C\u7531 DSH \u51ED\u8BC1\u670D\u52A1\u5728\u8FDE\u63A5\u65F6\u89E3\u6790\u3002"));
  })(), /* @__PURE__ */ h("div", { className: "hub-editor-modes" }, /* @__PURE__ */ h("button", { type: "button", className: mode === "json" ? "active" : "", disabled: busy || reading > 0, onClick: () => {
    setMode("json");
    setError("");
  } }, "JSON \u7F16\u8F91", jsonDirty && /* @__PURE__ */ h("span", { className: "hub-dirty-dot", title: "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539" })), /* @__PURE__ */ h("button", { type: "button", className: mode === "form" ? "active" : "", disabled: busy || reading > 0, onClick: () => {
    setMode("form");
    setError("");
  } }, "\u8868\u5355\u914D\u7F6E", formDirty && /* @__PURE__ */ h("span", { className: "hub-dirty-dot", title: "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539" }))), /* @__PURE__ */ h("fieldset", { disabled: busy || reading > 0 || testingAll, className: "hub-fields" }, mode === "json" ? /* @__PURE__ */ h("div", { className: "hub-json-config" }, /* @__PURE__ */ h("div", { className: "hub-json-toolbar" }, directUnnamed && /* @__PURE__ */ h("label", { className: "hub-field hub-json-format" }, "\u670D\u52A1\u540D\u79F0", /* @__PURE__ */ h("input", { value: jsonDirectName, onChange: (event) => setJsonDirectName(event.target.value), placeholder: "\u4F8B\u5982 context7" }), jsonDirectNameError && /* @__PURE__ */ h("small", { className: "bad" }, jsonDirectNameError)), /* @__PURE__ */ h("label", { className: "hub-field hub-json-format" }, "\u683C\u5F0F", /* @__PURE__ */ h("select", { value: jsonFormat, onChange: (event) => {
    setJsonFormat(event.target.value);
    setJsonRows([]);
    setJsonError("");
    setTests({});
    setAccepted({});
    setJsonChecks([]);
  }, "aria-label": "\u914D\u7F6E\u683C\u5F0F" }, /* @__PURE__ */ h("option", { value: "jsonc" }, "JSON / JSONC"), /* @__PURE__ */ h("option", { value: "toml" }, "TOML"))), /* @__PURE__ */ h("span", { className: "hub-help" }, jsonFormat === "toml" ? "TOML \u652F\u6301\u6279\u91CF\u7C98\u8D34\uFF1B\u6539\u540D\u548C\u5220\u9664\u8BF7\u5728\u6587\u672C\u4E2D\u64CD\u4F5C\u3002" : "\u53EF\u76F4\u63A5\u7C98\u8D34\u6574\u4EFD mcpServers \u914D\u7F6E\uFF1B\u91CD\u540D\u65F6\u5728\u6587\u672C\u4E2D\u6539\u540D\u540E\u91CD\u65B0\u6D4B\u8BD5\u3002")), /* @__PURE__ */ h("label", { className: "hub-field" }, "\u670D\u52A1\u5668\u914D\u7F6E", /* @__PURE__ */ h("textarea", { "aria-label": "JSON \u914D\u7F6E", className: "hub-json-editor", value: jsonText, onChange: (event) => {
    setJsonText(event.target.value);
    setJsonError("");
    setJsonBatchError("");
    setJsonChecks([]);
    setError("");
    setSaved(false);
  }, placeholder: jsonPlaceholder, spellCheck: "false" })), jsonError ? /* @__PURE__ */ h("p", { className: "bad", role: "alert" }, jsonError) : jsonRows.length > 0 ? /* @__PURE__ */ h("p", { className: "hub-help", role: "status" }, jsonSummary) : /* @__PURE__ */ h("p", { className: "hub-help" }, "\u7C98\u8D34\u540E\u4F1A\u7ACB\u5373\u89E3\u6790\uFF1B\u53EF\u4EE5\u4E00\u6B21\u6DFB\u52A0\u591A\u4E2A\u670D\u52A1\u3002"), !!jsonBatchError && /* @__PURE__ */ h("div", { className: "hub-banner warn", role: "alert" }, jsonBatchError), !!jsonRows.length && /* @__PURE__ */ h("div", { className: "hub-json-rows" }, jsonRows.map((row) => {
    const key = rowKey(row);
    const state = stateFor(row);
    const duplicate = duplicateName(row.name);
    const conflict = conflictRow(row);
    const invalid = invalidRow(row);
    const issues = rowIssues(row);
    const record = recordFor(row);
    return /* @__PURE__ */ h("article", { className: "hub-json-row " + state + (duplicate ? " duplicate" : "") + (conflict ? " conflict" : ""), key }, /* @__PURE__ */ h("div", { className: "hub-json-row-head" }, /* @__PURE__ */ h("strong", null, row.name || "\u672A\u547D\u540D\u670D\u52A1"), /* @__PURE__ */ h(Badge, null, row.entry?.transport || "\u672A\u77E5"), invalid && /* @__PURE__ */ h(Badge, { tone: "bad" }, "\u65E0\u6CD5\u89E3\u6790"), duplicate && /* @__PURE__ */ h(Badge, { tone: "warn" }, "\u5DF2\u5B58\u5728 \xB7 \u5C06\u8DF3\u8FC7"), conflict && /* @__PURE__ */ h(Badge, { tone: "bad" }, "\u91CD\u540D\u51B2\u7A81"), !invalid && !!row.entry?.enabled === false && /* @__PURE__ */ h(Badge, { tone: "muted" }, "\u505C\u7528"), state === "passed" && /* @__PURE__ */ h(Badge, { tone: "good" }, "\u6D4B\u8BD5\u901A\u8FC7"), state === "warn" && /* @__PURE__ */ h(Badge, { tone: "warn" }, "\u5DF2\u8FDE\u63A5 \xB7 \u5DE5\u5177\u53D1\u73B0\u5931\u8D25"), state === "failed" && /* @__PURE__ */ h(Badge, { tone: "bad" }, "\u6D4B\u8BD5\u5931\u8D25"), state === "untested" && /* @__PURE__ */ h(Badge, { tone: "muted" }, "\u672A\u6D4B\u8BD5")), invalid ? /* @__PURE__ */ h("p", { className: "bad" }, row.issues?.join("\uFF1B") || "\u8FD9\u4E2A\u670D\u52A1\u914D\u7F6E\u65E0\u6CD5\u89E3\u6790") : /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("p", { className: "hub-json-row-meta" }, row.entry.transport === "stdio" ? /* @__PURE__ */ h("code", null, row.entry.command) : /* @__PURE__ */ h("code", null, row.entry.url), /* @__PURE__ */ h("span", null, "\xB7"), Object.keys(row.entry.env ?? row.entry.headers ?? {}).length, " \u9879", row.entry.transport === "stdio" ? "\u73AF\u5883\u53D8\u91CF" : "\u8BF7\u6C42\u5934"), duplicate && /* @__PURE__ */ h("p", { className: "hub-json-rename-hint bad", role: "status" }, "\u540D\u79F0\u5DF2\u5B58\u5728\uFF0C\u5C06\u8DF3\u8FC7\uFF1B\u5982\u9700\u4F5C\u4E3A\u65B0\u670D\u52A1\u6DFB\u52A0\uFF0C\u8BF7\u4FEE\u6539 JSON \u4E2D\u7684\u670D\u52A1\u540D\u540E\u91CD\u65B0\u6D4B\u8BD5\u3002"), conflict && /* @__PURE__ */ h("p", { className: "hub-json-rename-hint bad", role: "status" }, "\u4E0E\u5176\u4ED6\u5F85\u6DFB\u52A0\u670D\u52A1\u91CD\u540D\uFF1B\u8BF7\u4FEE\u6539 JSON \u4E2D\u7684\u670D\u52A1\u540D\u540E\u91CD\u65B0\u6D4B\u8BD5\u3002"), !!issues.length && /* @__PURE__ */ h("div", { className: "hub-json-issues" }, /* @__PURE__ */ h("p", null, "\u6709 ", issues.length, " \u9879\u914D\u7F6E\u9700\u8981\u6838\u5BF9\uFF1A", issues.join("\uFF1B")), /* @__PURE__ */ h("label", null, /* @__PURE__ */ h("input", { type: "checkbox", checked: Boolean(accepted[key]), onChange: (event) => acceptRow(row, event.target.checked) }), "\u6211\u5DF2\u6838\u5BF9\uFF0C\u786E\u8BA4\u4E0D\u8FC1\u79FB\u4E0A\u8FF0\u5B57\u6BB5")), state !== "untested" && /* @__PURE__ */ h("p", { className: "hub-test-note " + state }, resultDetail(record?.error ? { error: record.error } : record.result)), /* @__PURE__ */ h("div", { className: "hub-json-row-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "hub-text-button", disabled: !canTest(row) || testingRow === key || testingAll, onClick: () => testRow(row) }, testingRow === key ? "\u6D4B\u8BD5\u4E2D\u2026" : "\u6D4B\u8BD5\u8FDE\u63A5"), /* @__PURE__ */ h("button", { type: "button", className: "hub-text-button danger", disabled: testingAll || !row.path?.length || jsonFormat !== "jsonc", onClick: () => removeRow(row) }, "\u5220\u9664"))));
  })), !!jsonChecks.length && /* @__PURE__ */ h(Checks, { checks: jsonChecks, busy: false, testing: false })) : /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("label", { className: "hub-field" }, "\u670D\u52A1\u540D\u79F0", /* @__PURE__ */ h("input", { value: formName, onChange: (event) => editName(event.target.value), placeholder: "\u4F8B\u5982 context7" }), /* @__PURE__ */ h("small", null, "\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u6216\u8FDE\u5B57\u7B26\uFF0C\u6700\u591A 32 \u4F4D\uFF1B\u6539\u540D\u4F1A\u5728\u4FDD\u5B58\u540E\u91CD\u5EFA\u8FDE\u63A5"), formNameError && /* @__PURE__ */ h("small", { className: "bad" }, formNameError)), /* @__PURE__ */ h("label", { className: "hub-field" }, "\u8FDE\u63A5\u65B9\u5F0F", /* @__PURE__ */ h("select", { value: transport, onChange: (event) => {
    const nextTransport = event.target.value;
    transportDrafts.current[formEntry.transport] = formEntry;
    setFormEntry({ ...transportDrafts.current[nextTransport] ?? (nextTransport === "stdio" ? blank() : { transport: nextTransport, url: "", headers: {} }), enabled: formEntry.enabled });
    setFormChecks([]);
    setFormVariables([]);
  } }, !["stdio", "streamable-http"].includes(transport) && /* @__PURE__ */ h("option", { value: transport }, transport, "\uFF08\u6682\u4E0D\u652F\u6301\uFF09"), /* @__PURE__ */ h("option", { value: "stdio" }, "stdio \xB7 \u672C\u5730\u547D\u4EE4"), /* @__PURE__ */ h("option", { value: "streamable-http" }, "Streamable HTTP \xB7 \u8FDC\u7A0B\u670D\u52A1"))), transport === "stdio" ? /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("label", { className: "hub-field" }, "\u542F\u52A8\u547D\u4EE4", /* @__PURE__ */ h("input", { value: formEntry.command ?? "", onChange: (event) => edit("command", event.target.value), placeholder: "npx\u3001uvx \u6216\u53EF\u6267\u884C\u6587\u4EF6\u7684\u7EDD\u5BF9\u8DEF\u5F84" })), /* @__PURE__ */ h(Arguments, { value: formEntry.args, onChange: (value) => edit("args", value), onReveal: reveal }), /* @__PURE__ */ h("label", { className: "hub-field" }, "\u5DE5\u4F5C\u76EE\u5F55 ", /* @__PURE__ */ h("span", { className: "hub-optional" }, "\u53EF\u9009"), /* @__PURE__ */ h("input", { value: formEntry.cwd ?? "", onChange: (event) => edit("cwd", event.target.value), placeholder: "\u7559\u7A7A\u7531 DSH \u51B3\u5B9A" }), /* @__PURE__ */ h("small", null, "\u672C\u5730\u547D\u4EE4\u7684\u8FD0\u884C\u76EE\u5F55\uFF1B\u547D\u4EE4\u6216\u53C2\u6570\u4F7F\u7528\u76F8\u5BF9\u8DEF\u5F84\u65F6\u586B\u5199\uFF0C\u4F8B\u5982\u9879\u76EE\u6839\u76EE\u5F55\u3002\u7559\u7A7A\u5219\u7EE7\u627F DSH \u5F53\u524D\u76EE\u5F55\u3002")), /* @__PURE__ */ h(Pairs, { label: "\u73AF\u5883\u53D8\u91CF", field: "env", value: formEntry.env, variables: formVariables, onReveal: reveal, peeks, onPeek: peek, onCopy: copy, onTestRenew: testRenew, now: peekClock, onChange: (value) => edit("env", value) })) : /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("label", { className: "hub-field" }, "\u670D\u52A1\u5730\u5740", /* @__PURE__ */ h("input", { value: formEntry.url ?? "", onChange: (event) => edit("url", event.target.value), placeholder: "https://example.com/mcp" }), /* @__PURE__ */ h("small", null, "\u5730\u5740\u4E2D\u7684\u51ED\u8BC1\u5DF2\u9690\u85CF\uFF0C\u4FEE\u6539\u5730\u5740\u65F6\u8BF7\u586B\u5199\u5B8C\u6574\u65B0\u5730\u5740\u3002")), /* @__PURE__ */ h("div", { className: "hub-field" }, /* @__PURE__ */ h("span", { className: "hub-label" }, "\u8BA4\u8BC1\u65B9\u5F0F"), /* @__PURE__ */ h("div", { className: "hub-auth-options" }, /* @__PURE__ */ h("label", null, /* @__PURE__ */ h("input", { type: "radio", name: "hub-auth", checked: formAuth !== "oauth", onChange: () => setFormAuth("token") }), " \u8BBF\u95EE\u4EE4\u724C\u6216\u81EA\u5B9A\u4E49\u8BF7\u6C42\u5934"), /* @__PURE__ */ h("label", null, /* @__PURE__ */ h("input", { type: "radio", name: "hub-auth", checked: formAuth === "oauth", onChange: () => setFormAuth("oauth") }), " OAuth \u767B\u5F55\uFF08\u6D4F\u89C8\u5668\u6388\u6743\uFF09")), formAuth === "oauth" && /* @__PURE__ */ h("p", { className: "hub-hint" }, "\u4FDD\u5B58\u540E\u70B9\u51FB\u5217\u8868\u91CC\u7684\u300C\u6388\u6743\u300D\u3002\u6D4F\u89C8\u5668\u767B\u5F55\u5B8C\u6210\u540E\uFF0C\u8BBF\u95EE\u4EE4\u724C\u4F1A\u5199\u5165 DSH \u51ED\u8BC1\u670D\u52A1\uFF0CAuthorization \u8BF7\u6C42\u5934\u7531\u63D2\u4EF6\u7EF4\u62A4\u3002")), formAuth !== "oauth" && /* @__PURE__ */ h(Pairs, { label: "\u8BF7\u6C42\u5934", field: "headers", value: formEntry.headers, variables: formVariables, onReveal: reveal, peeks, onPeek: peek, onCopy: copy, onTestRenew: testRenew, now: peekClock, onChange: (value) => edit("headers", value) })), !!formIssues.length && /* @__PURE__ */ h("div", { className: "hub-compatibility" }, /* @__PURE__ */ h("strong", null, "\u6709\u914D\u7F6E\u9700\u8981\u6838\u5BF9"), /* @__PURE__ */ h("ul", null, formIssues.map((issue) => /* @__PURE__ */ h("li", { key: issue }, issue))), /* @__PURE__ */ h("label", null, /* @__PURE__ */ h("input", { type: "checkbox", checked: formAccept, onChange: (event) => setFormAccept(event.target.checked) }), "\u6211\u5DF2\u6838\u5BF9\uFF0C\u786E\u8BA4\u4E0D\u8FC1\u79FB\u4E0A\u8FF0\u4E0D\u652F\u6301\u7684\u5B57\u6BB5")))), mode === "form" && /* @__PURE__ */ h(Checks, { checks: formChecks, busy, testing: busyAction === "check" }), error && /* @__PURE__ */ h("div", { className: "hub-banner warn", role: "alert" }, error, stale && /* @__PURE__ */ h("button", { className: "hub-text-button", onClick: resync }, "\u540C\u6B65\u6700\u65B0\u7248\u672C")), warnings.map((warning) => /* @__PURE__ */ h("div", { className: "hub-banner warn", key: warning }, warning))), /* @__PURE__ */ h("footer", { className: "hub-dialog-footer" }, /* @__PURE__ */ h("span", { className: "hub-help" }, mode === "json" ? original ? jsonHelp : `${jsonHelp}${jsonAddRows.length ? `\uFF08\u5DF2\u6D4B\u8BD5 ${jsonPassed}/${jsonAddRows.length}\uFF09` : ""}` : saved ? "\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u53EF\u4FEE\u6B63\u540E\u91CD\u8BD5" : original && formEntry.enabled === false ? "\u4FDD\u5B58\u914D\u7F6E\uFF0C\u4FDD\u6301\u505C\u7528" : "\u4FDD\u5B58\u540E\u9A8C\u8BC1\u6B63\u5F0F\u8FDE\u63A5\uFF1B\u65B0\u5EFA\u670D\u52A1\u9ED8\u8BA4\u542F\u7528"), /* @__PURE__ */ h("div", { className: "hub-actions" }, mode === "json" ? /* @__PURE__ */ h(import_react2.default.Fragment, null, !original && testingAll && /* @__PURE__ */ h("button", { className: "hub-button", onClick: cancelTests }, "\u53D6\u6D88\u6D4B\u8BD5"), !original && /* @__PURE__ */ h("button", { className: "hub-button", disabled: busy || testingAll || !jsonAddRows.filter(canTest).length, onClick: testAll }, testingAll ? `\u6D4B\u8BD5\u4E2D ${progress.done}/${progress.total}` : "\u6D4B\u8BD5\u5168\u90E8"), original && /* @__PURE__ */ h("button", { className: "hub-button", disabled: busy || !jsonEditRow || !canTest(jsonEditRow), onClick: () => jsonEditRow && testRow(jsonEditRow) }, testingRow ? "\u6D4B\u8BD5\u4E2D\u2026" : "\u6D4B\u8BD5\u8FDE\u63A5"), /* @__PURE__ */ h("button", { className: "hub-button primary", disabled: busy || testingAll || !(original ? jsonEditReady : jsonReady), onClick: submitJson }, busy && busyAction === "import" ? "\u6DFB\u52A0\u4E2D\u2026" : busy && busyAction === "save" ? "\u4FDD\u5B58\u4E2D\u2026" : original ? "\u4FDD\u5B58" : jsonSkipped.length && !jsonAddRows.length ? "\u6CA1\u6709\u53EF\u6DFB\u52A0" : `\u6DFB\u52A0${jsonAddRows.length ? ` ${jsonAddRows.length} \u4E2A` : ""}`)) : /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("button", { className: "hub-button", disabled: busy || !formCheckReady, onClick: () => submitForm("check") }, busy && busyAction === "check" ? "\u6D4B\u8BD5\u4E2D\u2026" : "\u6D4B\u8BD5\u8FDE\u63A5"), /* @__PURE__ */ h("button", { className: "hub-button primary", disabled: busy || !formReady, onClick: () => submitForm("save") }, busy && busyAction !== "check" ? "\u4FDD\u5B58\u4E2D\u2026" : original ? "\u4FDD\u5B58" : "\u6DFB\u52A0"))))));
}
function ServerRow({ server, busy, detail, detailLoading, onLoadTools, onEdit, onAction }) {
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [detailTab, setDetailTab] = (0, import_react2.useState)("tools");
  const [query, setQuery] = (0, import_react2.useState)("");
  const { name, entry, status, source, tools, verification } = server;
  const connected = status.state === "connected";
  const managed = server.managed ?? (server.editable ? "config" : "plugin");
  const verifying = verification?.state === "verifying";
  const signature = `${status.connectedAt ?? ""}:${status.toolCount ?? ""}`;
  (0, import_react2.useEffect)(() => {
    if (!open || detailTab !== "tools" || !connected) return;
    void onLoadTools(name, signature);
  }, [open, detailTab, connected, name, signature]);
  const rows = detail?.tools ?? tools;
  const loading = detailLoading && !detail;
  return /* @__PURE__ */ h("article", { className: "hub-server " + (open ? "expanded" : "") }, /* @__PURE__ */ h("div", { className: "hub-server-top" }, /* @__PURE__ */ h("button", { type: "button", className: "hub-expand-button", "aria-expanded": open, "aria-label": (open ? "\u6536\u8D77 " : "\u5C55\u5F00 ") + name, onClick: () => setOpen(!open) }, /* @__PURE__ */ h(Icon, { name: "chevron", className: open ? "rotated" : "" })), /* @__PURE__ */ h("span", { className: "hub-avatar" }, name.slice(0, 1).toUpperCase()), /* @__PURE__ */ h("button", { type: "button", className: "hub-server-name", onClick: () => setOpen(!open), "aria-expanded": open }, /* @__PURE__ */ h("strong", null, name), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h(Status, { status }), /* @__PURE__ */ h(Badge, null, connected ? status.toolCount ?? tools.length : "\u2014", " \u4E2A\u5DE5\u5177"), MANAGED[managed] && /* @__PURE__ */ h(Badge, null, MANAGED[managed]), !MANAGED[managed] && /* @__PURE__ */ h(Badge, null, entry?.transport === "stdio" ? "stdio" : entry?.transport === "streamable-http" ? "HTTP" : "\u63D2\u4EF6\u7BA1\u7406"), /* @__PURE__ */ h("span", { className: "hub-origin" }, source?.app), /* @__PURE__ */ h(StatusNote, { status, verification }))), /* @__PURE__ */ h("div", { className: "hub-actions" }, server.oauth && server.oauth.state !== "authorized" && server.oauth.state !== "none" && /* @__PURE__ */ h("button", { type: "button", className: "hub-button primary hub-row-auth", disabled: busy, onClick: () => onAction("oauth", server) }, server.oauth.state === "authorizing" ? "\u7EE7\u7EED\u6388\u6743" : server.oauth.state === "failed" ? "\u91CD\u65B0\u6388\u6743" : "\u6388\u6743"), verifying && /* @__PURE__ */ h(IconButton, { icon: "close", label: "\u53D6\u6D88\u9A8C\u8BC1 " + name, disabled: busy, onClick: () => onAction("cancel", server) }), /* @__PURE__ */ h(IconButton, { icon: "edit", label: "\u7F16\u8F91 " + name, disabled: !server.editable || busy, onClick: () => onEdit(server) }), /* @__PURE__ */ h(IconButton, { icon: "refresh", label: "\u91CD\u542F " + name, disabled: status.state === "disabled" || !server.editable || busy, onClick: () => onAction("restart", server) }), /* @__PURE__ */ h(IconButton, { icon: "trash", label: "\u5220\u9664 " + name, className: "danger", disabled: !server.removable || busy, onClick: () => onAction("remove", server) }), /* @__PURE__ */ h("button", { type: "button", className: "hub-switch", role: "switch", "aria-label": "\u542F\u7528 " + name, "aria-checked": entry?.enabled !== false && !!entry, disabled: !server.editable || busy, onClick: () => onAction("toggle", server) }, /* @__PURE__ */ h("span", null)))), server.oauth?.state === "authorizing" && /* @__PURE__ */ h("div", { className: "hub-row-oauth", role: "status" }, /* @__PURE__ */ h(Icon, { name: "info", size: 15 }), /* @__PURE__ */ h("span", null, "\u7B49\u5F85\u6D4F\u89C8\u5668\u5B8C\u6210\u6388\u6743\uFF1B\u5982\u679C\u9875\u9762\u6CA1\u6253\u5F00\u53EF\u4EE5"), server.oauth.url && /* @__PURE__ */ h("a", { className: "hub-text-button", href: server.oauth.url, target: "_blank", rel: "noopener noreferrer" }, "\u91CD\u65B0\u6253\u5F00\u6388\u6743\u9875"), /* @__PURE__ */ h("button", { type: "button", className: "hub-text-button", disabled: busy, onClick: () => onAction("oauth-cancel", server) }, "\u53D6\u6D88\u6388\u6743")), open && /* @__PURE__ */ h("div", { className: "hub-server-details" }, /* @__PURE__ */ h("div", { className: "hub-detail-tabs" }, [["tools", "\u5DE5\u5177"], ["config", "\u914D\u7F6E"], ["diagnostics", "\u8BCA\u65AD"]].map(([id, label]) => /* @__PURE__ */ h("button", { type: "button", key: id, className: id === detailTab ? "active" : "", onClick: () => setDetailTab(id) }, label, id === "tools" && /* @__PURE__ */ h("small", null, status.toolCount ?? tools.length)))), detailTab === "tools" && /* @__PURE__ */ h("div", { className: "hub-tools" }, /* @__PURE__ */ h("div", { className: "hub-detail-heading" }, /* @__PURE__ */ h("span", null, "\u670D\u52A1\u63D0\u4F9B\u7684\u5DE5\u5177"), rows.length > 3 && /* @__PURE__ */ h("input", { "aria-label": "\u641C\u7D22 " + name + " \u7684\u5DE5\u5177", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "\u641C\u7D22\u5DE5\u5177\u2026" })), loading && /* @__PURE__ */ h("p", { className: "hub-help", role: "status" }, /* @__PURE__ */ h("i", { className: "hub-spinner" }), "\u6B63\u5728\u8BFB\u53D6\u5DE5\u5177\u53C2\u6570\u2026"), !rows.length && !loading && /* @__PURE__ */ h("p", { className: "hub-help" }, connected ? "\u670D\u52A1\u5DF2\u8FDE\u63A5\uFF0C\u4F46\u6CA1\u6709\u8FD4\u56DE\u5DE5\u5177\uFF1B\u5DE5\u5177\u6E05\u5355\u7531\u4FDD\u5B58\u540E\u7684\u6B63\u5F0F\u8FDE\u63A5\u91CD\u65B0\u83B7\u53D6\uFF0C\u53EF\u5728\u300C\u8BCA\u65AD\u300D\u4E2D\u590D\u8BCA\u3002" : "\u670D\u52A1\u8FDE\u63A5\u6210\u529F\u540E\uFF0C\u8FD9\u91CC\u5C06\u663E\u793A\u53EF\u7528\u5DE5\u5177\u3002"), connected && !!rows.length && /* @__PURE__ */ h("p", { className: "hub-help" }, "\u5DE5\u5177\u6E05\u5355\u6765\u81EA\u4FDD\u5B58\u540E\u7684\u6B63\u5F0F\u8FDE\u63A5\uFF0C\u4E0D\u6CBF\u7528\u6DFB\u52A0\u9875\u7684\u6D4B\u8BD5\u7ED3\u679C\u3002"), rows.filter((tool) => (tool.name + tool.description).toLowerCase().includes(query.toLowerCase())).map((tool) => /* @__PURE__ */ h("details", { className: "hub-tool", key: tool.fullName ?? tool.name }, /* @__PURE__ */ h("summary", null, /* @__PURE__ */ h(Icon, { name: "bolt", size: 15 }), /* @__PURE__ */ h("code", null, tool.name), /* @__PURE__ */ h(Icon, { name: "chevron", size: 14 })), /* @__PURE__ */ h("p", null, tool.description || "\u65E0\u63CF\u8FF0"), tool.schema ? /* @__PURE__ */ h("pre", null, JSON.stringify(tool.schema, null, 2)) : /* @__PURE__ */ h("p", { className: "hub-help" }, "\u5C55\u5F00\u540E\u52A0\u8F7D\u53C2\u6570 Schema\u3002")))), detailTab === "config" && /* @__PURE__ */ h("div", { className: "hub-config" }, /* @__PURE__ */ h("div", { className: "hub-definition" }, /* @__PURE__ */ h("span", null, "\u914D\u7F6E\u5F52\u5C5E"), /* @__PURE__ */ h("strong", null, MANAGED[managed] ?? "DSH \u5168\u5C40\u914D\u7F6E"), /* @__PURE__ */ h("span", null, "\u5BFC\u5165\u6765\u6E90"), /* @__PURE__ */ h("strong", null, source?.app ?? "DSH"), source?.path && /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("span", null, "\u6765\u6E90\u6587\u4EF6"), /* @__PURE__ */ h("code", null, source.path))), /* @__PURE__ */ h("pre", null, JSON.stringify(entry, null, 2)), /* @__PURE__ */ h("p", { className: "hub-help" }, "\u51ED\u636E\u6309\u5B57\u6BB5\u540D\u9690\u85CF\uFF1B\u666E\u901A\u73AF\u5883\u53D8\u91CF\u4E0E\u542F\u52A8\u53C2\u6570\u6309\u539F\u503C\u663E\u793A\u3002")), detailTab === "diagnostics" && /* @__PURE__ */ h("div", { className: "hub-diagnostics" }, /* @__PURE__ */ h("div", { className: "hub-detail-heading" }, /* @__PURE__ */ h("span", null, "\u8FDE\u63A5\u8BCA\u65AD"), /* @__PURE__ */ h(Status, { status })), /* @__PURE__ */ h(StatusNote, { status, verification }), /* @__PURE__ */ h("p", null, status.lastError || (connected ? "\u670D\u52A1\u5DF2\u8FDE\u63A5\uFF0C\u5DE5\u5177\u5DF2\u540C\u6B65\u5230 DSH\u3002" : status.state === "disabled" ? "\u914D\u7F6E\u5DF2\u4FDD\u7559\uFF0C\u542F\u7528\u540E\u5F00\u59CB\u8FDE\u63A5\u3002" : "\u8BF7\u68C0\u67E5\u8FD0\u884C\u73AF\u5883\u3001\u53D8\u91CF\u548C\u8BA4\u8BC1\u914D\u7F6E\u3002")), /* @__PURE__ */ h("div", { className: "hub-definition" }, status.reason && /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("span", null, "\u505C\u6B62\u539F\u56E0"), /* @__PURE__ */ h("strong", null, REASON[status.reason] ?? status.reason)), status.attempt != null && /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("span", null, "\u91CD\u8BD5\u6B21\u6570"), /* @__PURE__ */ h("strong", null, status.attempt, "/", status.maxAttempts ?? "?")), !!status.nextRetryAtMs && /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("span", null, "\u4E0B\u6B21\u91CD\u8BD5"), /* @__PURE__ */ h("strong", null, new Date(status.nextRetryAtMs).toLocaleTimeString())), status.closeConfirmed === false && /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("span", null, "\u8FDE\u63A5\u6E05\u7406"), /* @__PURE__ */ h("strong", { className: "bad" }, "\u672A\u786E\u8BA4\u5173\u95ED")), !!status.cleanupError && /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("span", null, "\u6E05\u7406\u9519\u8BEF"), /* @__PURE__ */ h("strong", { className: "bad" }, status.cleanupError)), verification?.finishedAt && /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("span", null, "\u6700\u8FD1\u4E00\u6B21\u9A8C\u8BC1"), /* @__PURE__ */ h("strong", { className: verification.state === "ok" ? "good" : verification.state === "failed" ? "bad" : "muted" }, verification.detail ?? verification.state)), entry && /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("span", null, "\u590D\u8BCA"), /* @__PURE__ */ h("button", { className: "hub-text-button", disabled: busy, onClick: () => onAction("probe", server) }, "\u73B0\u5728\u590D\u8BCA\uFF08\u4E0D\u5F71\u54CD\u8FD0\u884C\u4E2D\u7684\u5B9E\u4F8B\uFF09"))))));
}
function Sources({ sources, scanning, scanError, onScan, onImport, onRemove }) {
  const [query, setQuery] = (0, import_react2.useState)("");
  const [expanded, setExpanded] = (0, import_react2.useState)({});
  const populated = (sources ?? []).filter((source) => source.candidates.length > 0);
  const failures = (sources ?? []).flatMap((source) => source.files.filter((file) => file.state === "error").map((file) => ({ ...file, app: source.name })));
  const filtered = populated.filter((source) => (source.name + source.candidates.map((row) => row.name).join(" ")).toLowerCase().includes(query.toLowerCase()));
  return /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("div", { className: "hub-toolbar" }, /* @__PURE__ */ h("label", { className: "hub-search" }, /* @__PURE__ */ h(Icon, { name: "search" }), /* @__PURE__ */ h("input", { "aria-label": "\u641C\u7D22\u672C\u5730 MCP", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "\u641C\u7D22 MCP \u540D\u79F0\u6216\u6765\u6E90\u2026" })), /* @__PURE__ */ h("button", { className: "hub-button", onClick: onScan, disabled: scanning }, /* @__PURE__ */ h(Icon, { name: "refresh", className: scanning ? "spinning" : "" }), scanning ? "\u626B\u63CF\u4E2D\u2026" : "\u91CD\u65B0\u626B\u63CF")), scanError && /* @__PURE__ */ h("div", { className: "hub-banner bad", role: "alert" }, scanError), failures.map((file) => /* @__PURE__ */ h("div", { className: "hub-banner warn", key: file.path, role: "alert" }, /* @__PURE__ */ h(Icon, { name: "info" }), /* @__PURE__ */ h("span", null, file.app, " \u7684\u914D\u7F6E\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u8BF7\u68C0\u67E5\u6587\u4EF6\u683C\u5F0F\u548C\u6743\u9650\u3002"))), !sources && !scanError && /* @__PURE__ */ h("div", { className: "hub-empty", role: "status" }, /* @__PURE__ */ h("span", { className: "hub-spinner" }), /* @__PURE__ */ h("p", null, "\u6B63\u5728\u67E5\u627E\u672C\u673A MCP \u914D\u7F6E\u2026")), sources && !populated.length && /* @__PURE__ */ h("div", { className: "hub-empty" }, /* @__PURE__ */ h(Icon, { name: "import", size: 30 }), /* @__PURE__ */ h("h2", null, "\u672A\u53D1\u73B0\u53EF\u5BFC\u5165\u7684 MCP"), /* @__PURE__ */ h("p", null, "\u53EF\u4EE5\u9009\u62E9\u914D\u7F6E\u6587\u4EF6\uFF0C\u6216\u5728\u5176\u4ED6\u5E94\u7528\u914D\u7F6E MCP \u540E\u91CD\u65B0\u626B\u63CF\u3002")), !!populated.length && !filtered.length && /* @__PURE__ */ h("div", { className: "hub-empty" }, /* @__PURE__ */ h(Icon, { name: "search", size: 30 }), /* @__PURE__ */ h("h2", null, "\u6CA1\u6709\u5339\u914D\u7684\u670D\u52A1"), /* @__PURE__ */ h("p", null, "\u8BD5\u8BD5\u5176\u4ED6\u540D\u79F0\u6216\u6765\u6E90\u3002")), /* @__PURE__ */ h("div", { className: "hub-source-list" }, filtered.map((source) => {
    const candidates = source.candidates.filter((row) => (row.name + source.name).toLowerCase().includes(query.toLowerCase()));
    const open = expanded[source.id] ?? !!query;
    return /* @__PURE__ */ h("article", { className: "hub-source " + (open ? "expanded" : ""), key: source.id }, /* @__PURE__ */ h("div", { className: "hub-source-heading-row" }, /* @__PURE__ */ h("button", { className: "hub-source-heading", type: "button", "aria-label": source.name, "aria-expanded": open, onClick: () => setExpanded({ ...expanded, [source.id]: !open }) }, /* @__PURE__ */ h(Icon, { name: "chevron", className: open ? "rotated" : "" }), /* @__PURE__ */ h("span", { className: "hub-source-logo " + source.id }, source.id === "opencode" ? "\u3008\u3009" : source.name.slice(0, 1)), /* @__PURE__ */ h("strong", { title: source.name }, source.name), /* @__PURE__ */ h(Badge, null, source.candidates.length, " \u9879\u914D\u7F6E"), /* @__PURE__ */ h("code", { title: source.files.find((file) => file.state === "read")?.path }, source.files.find((file) => file.state === "read")?.path)), source.manual && /* @__PURE__ */ h(IconButton, { icon: "trash", label: "\u79FB\u9664\u5BFC\u5165\u6765\u6E90 " + source.name, className: "danger", onClick: () => onRemove(source) })), open && /* @__PURE__ */ h("div", { className: "hub-source-content" }, candidates.map((candidate) => /* @__PURE__ */ h("div", { className: "hub-candidate", key: candidate.id }, /* @__PURE__ */ h("span", { className: "hub-candidate-icon" }, /* @__PURE__ */ h(Icon, { name: "box" })), /* @__PURE__ */ h("div", { className: "hub-candidate-info" }, /* @__PURE__ */ h("strong", null, candidate.name), /* @__PURE__ */ h("span", { title: candidate.entry.transport === "stdio" ? candidate.entry.command : candidate.entry.url }, candidate.entry.transport === "stdio" ? "\u672C\u5730\u547D\u4EE4" : "\u8FDC\u7A0B\u670D\u52A1", /* @__PURE__ */ h("i", null, "\xB7"), candidate.entry.transport === "stdio" ? candidate.entry.command : candidate.entry.url), candidate.detail && /* @__PURE__ */ h("small", null, "\u9879\u76EE\u7EA7 \xB7 ", candidate.detail), candidate.nameConflict && /* @__PURE__ */ h("small", { className: "warn" }, "\u540C\u540D\u5DF2\u5B58\u5728\uFF0C\u4F46\u914D\u7F6E\u4E0D\u540C\uFF08\u5BFC\u51FA\u914D\u7F6E\u65F6\u53EF\u80FD\u7701\u7565\u4E86\u51ED\u636E\uFF09\uFF1B\u786E\u8BA4\u662F\u65B0\u670D\u52A1\u65F6\u8BF7\u6539\u540D\u6DFB\u52A0"), !!candidate.issues.length && /* @__PURE__ */ h("small", { className: "warn" }, "\u6709 ", candidate.issues.length, " \u9879\u914D\u7F6E\u9700\u8981\u6838\u5BF9"), candidate.duplicateSource && /* @__PURE__ */ h("small", null, "\u4E5F\u53D1\u73B0\u4E8E ", candidate.duplicateSource)), candidate.duplicate ? /* @__PURE__ */ h("span", { className: "hub-already" }, /* @__PURE__ */ h(Icon, { name: "check", size: 15 }), "\u5DF2\u6DFB\u52A0 \xB7 ", candidate.duplicate, candidate.credentialOmitted ? "\uFF08\u51ED\u636E\u672A\u968F\u5907\u4EFD\u5BFC\u5165\uFF09" : "") : /* @__PURE__ */ h("button", { className: "hub-button", "aria-label": "\u6DFB\u52A0 " + candidate.name, onClick: () => onImport(candidate) }, /* @__PURE__ */ h(Icon, { name: "plus", size: 16 }), "\u6DFB\u52A0")))));
  })));
}
function CatalogPanel({ request, onInstall }) {
  const [query, setQuery] = (0, import_react2.useState)("");
  const [items, setItems] = (0, import_react2.useState)([]);
  const [nextCursor, setNextCursor] = (0, import_react2.useState)(null);
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [searched, setSearched] = (0, import_react2.useState)(false);
  const [searchedQuery, setSearchedQuery] = (0, import_react2.useState)("");
  const [error, setError] = (0, import_react2.useState)("");
  const [selected, setSelected] = (0, import_react2.useState)(null);
  const [adding, setAdding] = (0, import_react2.useState)("");
  const controller = (0, import_react2.useRef)(null);
  const requestRef = (0, import_react2.useRef)(request);
  const loadingMore = (0, import_react2.useRef)(false);
  const autoCursor = (0, import_react2.useRef)("");
  const sentinel = (0, import_react2.useRef)(null);
  requestRef.current = request;
  async function search(nextQuery, cursor) {
    const trimmed = nextQuery.trim();
    if (trimmed && trimmed.length < 3) {
      setError("\u5B98\u65B9 Registry \u8981\u6C42\u81F3\u5C11\u8F93\u5165 3 \u4E2A\u5B57\u7B26");
      return;
    }
    if (!cursor) autoCursor.current = "";
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setBusy(true);
    setError("");
    try {
      const result = await requestRef.current("/catalog-search", { query: nextQuery, cursor, limit: 20 }, next.signal);
      if (next.signal.aborted) return;
      setItems((current) => cursor ? [...current, ...result.items ?? []] : result.items ?? []);
      setNextCursor(result.nextCursor ?? null);
      setSearched(true);
      setSearchedQuery(nextQuery);
    } catch (searchError) {
      if (!next.signal.aborted) setError(textError(searchError));
    } finally {
      if (!next.signal.aborted) setBusy(false);
    }
  }
  async function quickAdd(item) {
    if (!item.canInstall || adding) return;
    setAdding(item.name);
    setError("");
    try {
      const result = await requestRef.current("/catalog-detail", { name: item.name });
      const install = result?.install;
      const option = install?.options?.[0];
      if (!option) {
        setSelected(item);
        return;
      }
      onInstall(install, option);
    } catch (addError) {
      setError(textError(addError));
    } finally {
      setAdding("");
    }
  }
  (0, import_react2.useEffect)(() => {
    void search("", null);
    return () => controller.current?.abort();
  }, []);
  (0, import_react2.useEffect)(() => {
    const node = sentinel.current;
    if (!node || !nextCursor || busy || searchedQuery !== query) return void 0;
    if (typeof IntersectionObserver === "undefined") return void 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || loadingMore.current || autoCursor.current === nextCursor) return;
      autoCursor.current = nextCursor;
      loadingMore.current = true;
      void search(query, nextCursor).finally(() => {
        loadingMore.current = false;
      });
    }, { rootMargin: "240px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, busy, query, searchedQuery]);
  return /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("div", { className: "hub-catalog-search" }, /* @__PURE__ */ h("form", { className: "hub-search hub-catalog-search-box", onSubmit: (event) => {
    event.preventDefault();
    void search(query, null);
  } }, /* @__PURE__ */ h(Icon, { name: "search" }), /* @__PURE__ */ h("input", { "aria-label": "\u641C\u7D22\u5B98\u65B9 MCP Registry", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "\u6309\u670D\u52A1\u540D\u79F0\u641C\u7D22\u5B98\u65B9 MCP Registry\uFF08\u81F3\u5C11 3 \u4E2A\u5B57\u7B26\uFF09\u2026" })), /* @__PURE__ */ h("button", { className: "hub-button", type: "button", disabled: busy, onClick: () => void search(query, null) }, busy ? "\u641C\u7D22\u4E2D\u2026" : "\u641C\u7D22")), /* @__PURE__ */ h("div", { className: "hub-catalog-hint", role: "status" }, /* @__PURE__ */ h(Icon, { name: "info", size: 15 }), /* @__PURE__ */ h("span", null, "\u53EA\u8BFB\u53D6\u5B98\u65B9 MCP Registry \u7684\u516C\u5F00\u76EE\u5F55\uFF1B\u7ED3\u679C\u6309\u5B98\u65B9\u670D\u52A1\u540D\u987A\u5E8F\u8FD4\u56DE\uFF0C\u6CA1\u6709\u70ED\u5EA6\u6216\u4E0B\u8F7D\u91CF\u6392\u5E8F\u3002\u4E0D\u4F1A\u81EA\u52A8\u5B89\u88C5\uFF0C\u6DFB\u52A0\u540E\u4ECD\u9700\u6D4B\u8BD5\u5E76\u4FDD\u5B58\u3002")), error && /* @__PURE__ */ h("div", { className: "hub-banner bad", role: "alert" }, /* @__PURE__ */ h(Icon, { name: "info" }), /* @__PURE__ */ h("span", null, error), /* @__PURE__ */ h("button", { className: "hub-text-button", onClick: () => void search(query, null) }, "\u91CD\u8BD5")), busy && !items.length && /* @__PURE__ */ h("div", { className: "hub-empty", role: "status" }, /* @__PURE__ */ h("span", { className: "hub-spinner" }), /* @__PURE__ */ h("p", null, "\u6B63\u5728\u8BFB\u53D6\u5B98\u65B9\u76EE\u5F55\u2026")), searched && !busy && !items.length && !error && /* @__PURE__ */ h("div", { className: "hub-empty" }, /* @__PURE__ */ h(Icon, { name: "search", size: 30 }), /* @__PURE__ */ h("h2", null, "\u6CA1\u6709\u627E\u5230\u5339\u914D\u7684\u670D\u52A1"), /* @__PURE__ */ h("p", null, "\u6362\u4E2A\u5173\u952E\u8BCD\uFF0C\u6216\u76F4\u63A5\u7C98\u8D34\u914D\u7F6E\u624B\u52A8\u6DFB\u52A0\u3002")), !!items.length && /* @__PURE__ */ h("div", { className: "hub-catalog-list" }, items.map((item) => /* @__PURE__ */ h("article", { className: "hub-catalog-card", key: item.name }, /* @__PURE__ */ h("div", { className: "hub-catalog-content" }, /* @__PURE__ */ h("div", { className: "hub-catalog-card-head" }, /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("strong", null, item.title || item.name), /* @__PURE__ */ h("code", { title: item.name }, item.name)), item.version && /* @__PURE__ */ h(Badge, null, item.version)), item.description && /* @__PURE__ */ h("p", { className: "hub-catalog-description" }, item.description), /* @__PURE__ */ h("div", { className: "hub-catalog-meta" }, !item.canInstall && /* @__PURE__ */ h(Badge, { tone: "warn" }, "\u6682\u4E0D\u652F\u6301\u81EA\u52A8\u8F6C\u6362"), (item.packageTypes ?? []).map((type) => /* @__PURE__ */ h(Badge, { key: "pkg-" + type }, type)), (item.transports ?? []).map((transport) => /* @__PURE__ */ h(Badge, { key: "transport-" + transport }, transport === "streamable-http" ? "HTTP" : transport.toUpperCase())), item.updatedAt && /* @__PURE__ */ h("span", { className: "hub-catalog-updated" }, "\u66F4\u65B0\u4E8E ", formatDate(item.updatedAt)))), /* @__PURE__ */ h("div", { className: "hub-catalog-card-actions" }, /* @__PURE__ */ h(IconButton, { icon: "eye", size: 16, label: "\u67E5\u770B\u8BE6\u60C5", onClick: () => setSelected(item) }), item.canInstall && /* @__PURE__ */ h(IconButton, { icon: "plus", size: 17, label: adding === item.name ? "\u6DFB\u52A0\u4E2D\u2026" : "\u6DFB\u52A0\u5230 MCP Hub\uFF08\u9ED8\u8BA4\u4F7F\u7528\u7B2C\u4E00\u79CD\u5B89\u88C5\u65B9\u5F0F\uFF09", disabled: adding === item.name, onClick: () => void quickAdd(item) }))))), !!nextCursor && searchedQuery === query && /* @__PURE__ */ h("div", { className: "hub-catalog-sentinel", ref: sentinel, role: "status" }, busy ? "\u6B63\u5728\u52A0\u8F7D\u66F4\u591A\u2026" : ""), selected && /* @__PURE__ */ h(CatalogDialog, { item: selected, request, onClose: () => setSelected(null) }));
}
function CatalogDialog({ item, request, onClose }) {
  const [detail, setDetail] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)("");
  const [loading, setLoading] = (0, import_react2.useState)(true);
  const dialog = useDialog(onClose, loading);
  (0, import_react2.useEffect)(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request("/catalog-detail", { name: item.name }, controller.signal).then((result) => {
      if (!controller.signal.aborted) setDetail(result);
    }).catch((detailError) => {
      if (!controller.signal.aborted) setError(textError(detailError));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [item.name, request]);
  const install = detail?.install;
  const options = install?.options ?? [];
  return /* @__PURE__ */ h("div", { className: "hub-overlay" }, /* @__PURE__ */ h("section", { ref: dialog, className: "hub-dialog hub-catalog-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "hub-catalog-title" }, /* @__PURE__ */ h("header", { className: "hub-dialog-header" }, /* @__PURE__ */ h("div", { className: "hub-catalog-title-row" }, item.icon && /* @__PURE__ */ h("img", { className: "hub-catalog-icon", src: item.icon, alt: "", loading: "lazy", referrerPolicy: "no-referrer", onError: (event) => {
    event.currentTarget.style.display = "none";
  } }), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h2", { id: "hub-catalog-title" }, item.title || item.name), /* @__PURE__ */ h("code", { className: "hub-catalog-registry-name" }, item.name))), /* @__PURE__ */ h(IconButton, { icon: "close", label: "\u5173\u95ED\u8BE6\u60C5", onClick: onClose, disabled: loading })), /* @__PURE__ */ h("div", { className: "hub-dialog-body" }, loading && /* @__PURE__ */ h("p", { className: "hub-help", role: "status" }, /* @__PURE__ */ h("i", { className: "hub-spinner" }), "\u6B63\u5728\u8BFB\u53D6\u670D\u52A1\u8BE6\u60C5\u2026"), error && /* @__PURE__ */ h("div", { className: "hub-banner bad", role: "alert" }, /* @__PURE__ */ h(Icon, { name: "info" }), /* @__PURE__ */ h("span", null, error), /* @__PURE__ */ h("button", { className: "hub-text-button", onClick: () => {
    setDetail(null);
    setLoading(true);
    setError("");
    request("/catalog-detail", { name: item.name }).then(setDetail).catch((next) => setError(textError(next))).finally(() => setLoading(false));
  } }, "\u91CD\u8BD5")), !loading && install && /* @__PURE__ */ h(import_react2.default.Fragment, null, install.version && /* @__PURE__ */ h("p", { className: "hub-help" }, "\u7248\u672C ", /* @__PURE__ */ h("code", null, install.version), item.websiteUrl && /* @__PURE__ */ h(import_react2.default.Fragment, null, " \xB7 ", /* @__PURE__ */ h("a", { href: item.websiteUrl, target: "_blank", rel: "noopener noreferrer" }, "\u5B98\u7F51")), install.repository && /* @__PURE__ */ h(import_react2.default.Fragment, null, " \xB7 ", /* @__PURE__ */ h("a", { href: install.repository, target: "_blank", rel: "noopener noreferrer" }, "\u4ED3\u5E93")), item.updatedAt && /* @__PURE__ */ h(import_react2.default.Fragment, null, " \xB7 ", "\u66F4\u65B0\u4E8E ", /* @__PURE__ */ h("time", { dateTime: item.updatedAt }, formatDate(item.updatedAt)))), item.description && /* @__PURE__ */ h("p", { className: "hub-catalog-description" }, item.description), !!install.warnings.length && /* @__PURE__ */ h("div", { className: "hub-banner warn", role: "alert" }, /* @__PURE__ */ h(Icon, { name: "info" }), /* @__PURE__ */ h("span", null, [...new Set(install.warnings)].join("\uFF1B"))), !!install.unsupported.length && /* @__PURE__ */ h("div", { className: "hub-banner warn", role: "alert" }, /* @__PURE__ */ h(Icon, { name: "info" }), /* @__PURE__ */ h("span", null, install.unsupported.join("\uFF1B"))), !options.length && /* @__PURE__ */ h("div", { className: "hub-empty" }, /* @__PURE__ */ h(Icon, { name: "info", size: 28 }), /* @__PURE__ */ h("h2", null, "\u6682\u4E0D\u652F\u6301\u81EA\u52A8\u6DFB\u52A0"), /* @__PURE__ */ h("p", null, "\u8FD9\u4E2A\u670D\u52A1\u6CA1\u6709\u53EF\u8F6C\u6362\u4E3A DSH \u914D\u7F6E\u7684\u5305\u6216 HTTP \u5730\u5740\uFF1B\u53EF\u4EE5\u590D\u5236\u4ED3\u5E93\u4E2D\u7684\u914D\u7F6E\u624B\u52A8\u6DFB\u52A0\u3002")), !!options.length && /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("h3", { className: "hub-catalog-section-title" }, "\u5B89\u88C5\u65B9\u5F0F"), /* @__PURE__ */ h("div", { className: "hub-catalog-options" }, options.map((row) => /* @__PURE__ */ h("div", { className: "hub-catalog-option", key: row.id }, /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("strong", null, row.label), /* @__PURE__ */ h("small", null, row.entry.transport === "stdio" ? /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("code", null, row.entry.command), " ", row.entry.args?.join(" ")) : /* @__PURE__ */ h("code", null, row.entry.url)), !!row.warnings?.length && /* @__PURE__ */ h("small", { className: "bad" }, row.warnings.join("\uFF1B")))))), options.length > 1 && /* @__PURE__ */ h("p", { className: "hub-help" }, "\u5217\u8868\u4E2D\u7684\u300C\u6DFB\u52A0\u300D\u9ED8\u8BA4\u4F7F\u7528\u7B2C\u4E00\u79CD\u65B9\u5F0F\uFF1B\u5176\u4ED6\u65B9\u5F0F\u53EF\u4EE5\u6DFB\u52A0\u540E\u5728\u8868\u5355\u6216 JSON \u4E2D\u8C03\u6574\u3002"), /* @__PURE__ */ h("div", { className: "hub-catalog-entry" }, /* @__PURE__ */ h("h3", { className: "hub-catalog-entry-title" }, "\u9ED8\u8BA4\u5C06\u5199\u5165\u7684\u914D\u7F6E"), /* @__PURE__ */ h("pre", null, JSON.stringify(options[0].entry, null, 2))))))));
}
function App({ request = apiRequest, preview = false, locale }) {
  const [, setLocaleTick] = (0, import_react2.useState)(0);
  (0, import_react2.useEffect)(() => {
    if (!locale) return void 0;
    const sync = () => {
      setLocale(locale.getSnapshot().active);
      setLocaleTick((tick) => tick + 1);
    };
    sync();
    return locale.subscribe(sync);
  }, [locale]);
  const [tab, setTab] = (0, import_react2.useState)("installed");
  const [data, setData] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)("");
  const [loadError, setLoadError] = (0, import_react2.useState)("");
  const [notice, setNotice] = (0, import_react2.useState)(null);
  const oauthPolling = (0, import_react2.useRef)(/* @__PURE__ */ new Set());
  const [noticePaused, setNoticePaused] = (0, import_react2.useState)(false);
  const [deleteError, setDeleteError] = (0, import_react2.useState)("");
  const [loading, setLoading] = (0, import_react2.useState)(true);
  const [scanning, setScanning] = (0, import_react2.useState)(false);
  const [scanError, setScanError] = (0, import_react2.useState)("");
  const [sources, setSources] = (0, import_react2.useState)(null);
  const [query, setQuery] = (0, import_react2.useState)("");
  const [filter, setFilter] = (0, import_react2.useState)("all");
  const [draft, setDraft] = (0, import_react2.useState)(null);
  const [confirm, setConfirm] = (0, import_react2.useState)(null);
  const [exportOpen, setExportOpen] = (0, import_react2.useState)(false);
  const [exportBusy, setExportBusy] = (0, import_react2.useState)(false);
  const [exportError, setExportError] = (0, import_react2.useState)("");
  const [busy, setBusy] = (0, import_react2.useState)("");
  const [toolDetails, setToolDetails] = (0, import_react2.useState)({});
  const fileInput = (0, import_react2.useRef)(null);
  const alive = (0, import_react2.useRef)(true);
  const generation = (0, import_react2.useRef)(0);
  const sourcesLoaded = (0, import_react2.useRef)(false);
  const sourceRevision = (0, import_react2.useRef)(null);
  const sourceGeneration = (0, import_react2.useRef)(0);
  const initialScanStarted = (0, import_react2.useRef)(false);
  const scanningTask = (0, import_react2.useRef)(null);
  const version = (0, import_react2.useRef)(0);
  const revision = (0, import_react2.useRef)(-1);
  const dataRef = (0, import_react2.useRef)(null);
  (0, import_react2.useEffect)(() => {
    dataRef.current = data;
  }, [data]);
  async function refresh(quiet = false) {
    const id = ++generation.current;
    if (!quiet) setLoading(true);
    try {
      const next = await request("/servers");
      if (alive.current && id === generation.current) {
        setData(next);
        setLoadError("");
        version.current = next.version ?? version.current + 1;
        revision.current = next.revision;
        if (sourcesLoaded.current && sourceRevision.current !== next.revision) await syncSources(next.revision);
      }
      return next;
    } catch (error2) {
      if (alive.current && id === generation.current) setLoadError(textError(error2));
      throw error2;
    } finally {
      if (alive.current && id === generation.current) setLoading(false);
    }
  }
  function mergeStatus(rows) {
    setData((current) => {
      if (!current) return current;
      const byName = new Map(rows.map((row) => [row.name, row]));
      const servers2 = current.servers.map((server) => {
        const row = byName.get(server.name);
        if (!row) return server;
        const { name, editable, verification, ...status } = row;
        return { ...server, status, verification, editable: editable ?? server.editable };
      });
      return { ...current, servers: servers2 };
    });
  }
  function applySnapshot(snapshot) {
    if (!snapshot) return;
    version.current = snapshot.version ?? version.current;
    if (snapshot.revision !== revision.current) {
      refresh(true).catch(() => {
      });
      return;
    }
    const current = dataRef.current;
    if (!current) return;
    if ((snapshot.servers ?? []).length !== current.servers.length || (snapshot.servers ?? []).some((row) => !current.servers.some((server) => server.name === row.name))) {
      refresh(true).catch(() => {
      });
      return;
    }
    mergeStatus(snapshot.servers ?? []);
  }
  (0, import_react2.useEffect)(() => {
    alive.current = true;
    refresh().catch(() => {
    });
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      while (!cancelled && alive.current) {
        try {
          const snapshot = await request("/wait", { version: version.current, revision: revision.current, timeoutMs: 2e4 }, controller.signal);
          if (cancelled || !alive.current) return;
          applySnapshot(snapshot);
        } catch (error2) {
          if (cancelled || error2?.name === "AbortError") return;
          await sleep(2e3);
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      alive.current = false;
    };
  }, [request]);
  (0, import_react2.useEffect)(() => {
    if (!notice || noticePaused) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice, noticePaused]);
  function notify(text, tone = "good") {
    setNoticePaused(false);
    setNotice({ text, tone, id: Date.now() });
  }
  async function syncSources(nextRevision) {
    const id = ++sourceGeneration.current;
    try {
      const result = await request("/sources");
      if (alive.current && id === sourceGeneration.current) {
        setSources(result.sources);
        setScanError("");
        sourceRevision.current = nextRevision;
      }
    } catch (error2) {
      if (alive.current) setScanError("\u5BFC\u5165\u72B6\u6001\u66F4\u65B0\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u626B\u63CF\u540E\u91CD\u8BD5");
    }
  }
  const hostReady = Boolean(data);
  (0, import_react2.useEffect)(() => {
    if (!hostReady || initialScanStarted.current) return;
    initialScanStarted.current = true;
    void scan();
  }, [hostReady]);
  async function scan() {
    if (scanningTask.current) return scanningTask.current;
    setScanning(true);
    setScanError("");
    const task = (async () => {
      try {
        const result = await request("/scan", {});
        if (alive.current) {
          setSources(result.sources);
          sourcesLoaded.current = true;
          sourceRevision.current = revision.current;
        }
      } catch (error2) {
        if (alive.current) setScanError(textError(error2));
      } finally {
        if (alive.current) {
          setScanning(false);
          scanningTask.current = null;
        }
      }
    })();
    scanningTask.current = task;
    return task;
  }
  async function readConfigFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 200 * 1024) {
      setError("\u914D\u7F6E\u6587\u4EF6\u8D85\u8FC7 200 KB\uFF0C\u8BF7\u4F7F\u7528\u8F83\u5C0F\u7684 MCP \u914D\u7F6E\u6587\u4EF6");
      return;
    }
    setScanning(true);
    setError("");
    try {
      const result = await request("/parse", { filename: file.name, text: await file.text() });
      setSources((previous) => [...previous ?? [], ...result.sources]);
      sourcesLoaded.current = true;
    } catch (error2) {
      setError(textError(error2));
    } finally {
      setScanning(false);
    }
  }
  async function removeImportedSource(source) {
    setBusy("source");
    setError("");
    try {
      await request("/source-remove", { id: source.id });
      if (alive.current) {
        setSources((previous) => (previous ?? []).filter((item) => item.id !== source.id));
        sourcesLoaded.current = true;
      }
    } catch (error2) {
      setError(textError(error2));
    } finally {
      setBusy("");
    }
  }
  async function loadTools(name, signature) {
    const cached = toolDetails[name];
    if (cached?.signature === signature && cached.tools) return;
    if (cached?.loading === signature) return;
    setToolDetails((current) => ({ ...current, [name]: { ...current[name], loading: signature } }));
    try {
      const result = await request("/tools", { name });
      if (!alive.current) return;
      setToolDetails((current) => ({ ...current, [name]: { signature, tools: result.tools } }));
    } catch (error2) {
      if (!alive.current) return;
      setToolDetails((current) => ({ ...current, [name]: { ...current[name], loading: void 0 } }));
      setError(textError(error2));
    }
  }
  async function pollOAuth(name) {
    if (oauthPolling.current.has(name)) return;
    oauthPolling.current.add(name);
    try {
      for (let i = 0; i < 120; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        const status = await request("/oauth-status", { name });
        if (status.state === "authorized") {
          notify(`\u5DF2\u6388\u6743 ${name}\uFF0C\u6B63\u5728\u91CD\u65B0\u8FDE\u63A5`);
          await refresh(true);
          return;
        }
        if (status.state === "failed") {
          setError(status.error || "OAuth \u6388\u6743\u5931\u8D25");
          await refresh(true);
          return;
        }
        if (status.state === "needs-auth" || status.state === "none") {
          await refresh(true);
          return;
        }
        if (status.state === "cancelled") {
          await refresh(true);
          return;
        }
      }
      await refresh(true);
    } catch {
      try {
        await refresh(true);
      } catch {
      }
    } finally {
      oauthPolling.current.delete(name);
    }
  }
  (0, import_react2.useEffect)(() => {
    for (const server of data?.servers ?? []) if (server.oauth?.state === "authorizing") void pollOAuth(server.name);
  }, [data]);
  async function action(action2, server, confirmed = false) {
    if (action2 === "oauth-cancel") {
      setBusy(server.name);
      setError("");
      try {
        await request("/oauth-cancel", { name: server.name });
        await refresh(true);
      } catch (error2) {
        setError(textError(error2));
      } finally {
        setBusy("");
      }
      return;
    }
    if (action2 === "oauth") {
      setBusy(server.name);
      setError("");
      try {
        const started = await request("/oauth-start", { name: server.name, open: true });
        if (started?.state === "authorized") {
          await refresh(true);
          return;
        }
        await refresh(true);
        void pollOAuth(server.name);
      } catch (error2) {
        setError(textError(error2));
      } finally {
        setBusy("");
      }
      return;
    }
    if (action2 === "remove" && !confirmed) {
      setDeleteError("");
      setConfirm(server);
      return;
    }
    if (action2 === "cancel") {
      setBusy(server.name);
      setError("");
      try {
        await request("/cancel", { name: server.name });
        await refresh(true);
      } catch (error2) {
        setError(textError(error2));
      } finally {
        setBusy("");
      }
      return;
    }
    if (action2 === "probe") {
      setBusy(server.name);
      setError("");
      try {
        await request("/probe", { name: server.name });
        await refresh(true);
      } catch (error2) {
        setError(textError(error2));
      } finally {
        setBusy("");
      }
      return;
    }
    setBusy(server.name);
    setError("");
    setDeleteError("");
    setNotice(null);
    try {
      const result = await request("/mutate", { action: action2, name: server.name, revision: data.revision, enabled: server.entry?.enabled === false });
      await refresh(true);
      setConfirm(null);
      if (action2 === "remove" && result.cleanup?.length) notify(`\u5DF2\u5220\u9664 ${server.name}\uFF1B${result.cleanup.length} \u4E2A\u51ED\u8BC1\u5DF2\u65E0\u5F15\u7528\uFF0C\u53EF\u5728 DSH \u51ED\u8BC1\u7BA1\u7406\u4E2D\u6E05\u7406`, "muted");
    } catch (error2) {
      if (action2 === "remove") setDeleteError(textError(error2));
      else setError(textError(error2));
    } finally {
      setBusy("");
    }
  }
  async function restartFailed() {
    const targets = servers.filter((server) => server.editable && ["failed", "waiting-credentials", "reconnecting"].includes(server.status.state)).map((server) => server.name);
    if (!targets.length) {
      notify("\u6CA1\u6709\u9700\u8981\u91CD\u8FDE\u7684\u670D\u52A1", "muted");
      return;
    }
    setBusy("bulk");
    setError("");
    try {
      const result = await request("/mutate", { action: "bulk", operation: "restart", names: targets, revision: data.revision });
      await refresh(true);
      notify(`\u5DF2\u8BF7\u6C42\u91CD\u8FDE ${result.affected} \u4E2A\u670D\u52A1`);
    } catch (error2) {
      setError(textError(error2));
    } finally {
      setBusy("");
    }
  }
  async function exportConfig(includeSecrets) {
    setExportBusy(true);
    setExportError("");
    try {
      const result = await request("/export", { includeSecrets });
      const count = Object.keys(result?.backup ?? {}).length;
      if (!count) {
        setExportOpen(false);
        notify("\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u914D\u7F6E", "muted");
        return;
      }
      const suffix = includeSecrets ? "-with-secrets" : "";
      download("mcp-hub-backup-" + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + suffix + ".json", JSON.stringify({ format: "dsh-mcp-hub-backup", version: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), servers: result.backup }, null, 2));
      setExportOpen(false);
      const omitted = result.omitted?.length ?? 0;
      const unresolved = result.credentialsMissing?.length ?? 0;
      if (includeSecrets) notify(unresolved ? `\u5DF2\u5BFC\u51FA ${count} \u4E2A\u670D\u52A1\uFF1B${unresolved} \u4E2A\u51ED\u8BC1\u672A\u914D\u7F6E\uFF0C\u4ECD\u4EE5\u5F15\u7528\u5F62\u5F0F\u5BFC\u51FA` : `\u5DF2\u5BFC\u51FA ${count} \u4E2A\u670D\u52A1\uFF08\u5305\u542B\u5BC6\u94A5\uFF09\uFF0C\u8BF7\u59A5\u5584\u4FDD\u7BA1`, "warn");
      else notify(omitted ? `\u5DF2\u5BFC\u51FA ${count} \u4E2A\u670D\u52A1\uFF1B${omitted} \u4E2A\u51ED\u636E\u5B57\u6BB5\u672A\u5BFC\u51FA\uFF0C\u6062\u590D\u540E\u9700\u91CD\u65B0\u586B\u5199` : `\u5DF2\u5BFC\u51FA ${count} \u4E2A\u670D\u52A1`);
    } catch (error2) {
      setExportError(textError(error2));
    } finally {
      setExportBusy(false);
    }
  }
  const servers = data?.servers ?? [];
  const connected = servers.filter((server) => server.status.state === "connected").length;
  const failures = servers.filter((server) => ["failed", "waiting-credentials", "broken"].includes(server.managed) || ["failed", "waiting-credentials"].includes(server.status.state)).length;
  const visible = servers.filter((server) => (server.name + (server.source?.app ?? "")).toLowerCase().includes(query.toLowerCase()) && (filter === "all" || filter === "connected" && server.status.state === "connected" || filter === "disabled" && server.status.state === "disabled" || filter === "failed" && ["failed", "waiting-credentials"].includes(server.status.state)));
  return /* @__PURE__ */ h("main", { className: "mcp-hub", "data-preview": preview }, /* @__PURE__ */ h("header", { className: "hub-header" }, /* @__PURE__ */ h("div", { className: "hub-brand" }, /* @__PURE__ */ h("div", { className: "hub-brand-copy" }, /* @__PURE__ */ h("div", { className: "hub-brand-title" }, /* @__PURE__ */ h("h1", null, "MCP Hub"), /* @__PURE__ */ h("div", { className: "hub-repo-links" }, /* @__PURE__ */ h("a", { className: "hub-github-link", href: "https://github.com/mr-hanlu/dsh-mcp-hub", target: "_blank", rel: "noopener noreferrer", "aria-label": "\u6253\u5F00 GitHub \u9879\u76EE" }, /* @__PURE__ */ h(GitHubMark, null), "GitHub"))))), /* @__PURE__ */ h("div", { className: "hub-header-actions" }, /* @__PURE__ */ h("button", { className: "hub-button primary", disabled: !data, onClick: () => setDraft({ entry: blank() }) }, /* @__PURE__ */ h(Icon, { name: "plus", size: 15 }), "\u6DFB\u52A0 MCP"))), /* @__PURE__ */ h("p", { className: "hub-description" }, "\u8FDE\u63A5\u3001\u7BA1\u7406\u4F60\u7684 MCP \u670D\u52A1\uFF0C\u628A\u5E38\u7528\u5DE5\u5177\u5E26\u5230 DSH\u3002"), /* @__PURE__ */ h("nav", { className: "hub-main-tabs", "aria-label": "MCP Hub \u9875\u9762" }, /* @__PURE__ */ h("button", { type: "button", "aria-current": tab === "installed" ? "page" : void 0, className: tab === "installed" ? "active" : "", onClick: () => setTab("installed") }, /* @__PURE__ */ h(Icon, { name: "box" }), "\u5DF2\u6DFB\u52A0 ", /* @__PURE__ */ h("small", null, servers.length)), /* @__PURE__ */ h("button", { type: "button", "aria-current": tab === "import" ? "page" : void 0, className: tab === "import" ? "active" : "", onClick: () => setTab("import") }, /* @__PURE__ */ h(Icon, { name: "import" }), "\u672C\u5730\u5BFC\u5165"), /* @__PURE__ */ h("button", { type: "button", "aria-current": tab === "catalog" ? "page" : void 0, className: tab === "catalog" ? "active" : "", onClick: () => setTab("catalog") }, /* @__PURE__ */ h(Icon, { name: "search" }), "\u5728\u7EBF\u641C\u7D22")), (error || loadError) && /* @__PURE__ */ h("div", { className: "hub-banner bad", role: "alert" }, /* @__PURE__ */ h(Icon, { name: "info" }), /* @__PURE__ */ h("span", null, error || loadError), /* @__PURE__ */ h("button", { className: "hub-text-button", onClick: () => {
    setError("");
    refresh().catch(() => {
    });
  } }, "\u91CD\u8BD5")), notice && /* @__PURE__ */ h("div", { className: "hub-toast " + notice.tone, role: "status", onMouseEnter: () => setNoticePaused(true), onMouseLeave: () => setNoticePaused(false), onFocus: () => setNoticePaused(true), onBlur: () => setNoticePaused(false) }, /* @__PURE__ */ h(Icon, { name: notice.tone === "good" ? "check" : "info" }), /* @__PURE__ */ h("span", null, notice.text), /* @__PURE__ */ h(IconButton, { icon: "close", label: "\u5173\u95ED\u901A\u77E5", onClick: () => setNotice(null) })), /* @__PURE__ */ h(Boundary, null, tab === "catalog" ? /* @__PURE__ */ h(CatalogPanel, { request, onInstall: (install, option) => setDraft({ name: install.name, entry: option.entry, initialMode: "form", source: "\u5B98\u65B9 MCP Registry", sourcePath: install.registryName, jsonText: JSON.stringify({ mcpServers: { [install.name]: option.entry } }, null, 2), jsonFormat: "json" }) }) : tab === "installed" ? /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("div", { className: "hub-stats" }, /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("strong", null, servers.length), /* @__PURE__ */ h("span", null, "\u4E2A MCP \u670D\u52A1")), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("i", { className: "good" }), /* @__PURE__ */ h("strong", null, connected), /* @__PURE__ */ h("span", null, "\u5DF2\u8FDE\u63A5")), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("i", { className: failures ? "bad" : "muted" }), /* @__PURE__ */ h("strong", null, failures), /* @__PURE__ */ h("span", null, "\u9700\u8981\u5904\u7406"))), /* @__PURE__ */ h("div", { className: "hub-toolbar" }, /* @__PURE__ */ h("label", { className: "hub-search" }, /* @__PURE__ */ h(Icon, { name: "search" }), /* @__PURE__ */ h("input", { "aria-label": "\u641C\u7D22\u5DF2\u6DFB\u52A0\u7684 MCP", value: query, onChange: (event) => setQuery(event.target.value), placeholder: "\u641C\u7D22\u670D\u52A1\u540D\u79F0\u6216\u6765\u6E90\u2026" })), /* @__PURE__ */ h("select", { "aria-label": "\u7B5B\u9009\u8FDE\u63A5\u72B6\u6001", value: filter, onChange: (event) => setFilter(event.target.value) }, /* @__PURE__ */ h("option", { value: "all" }, "\u5168\u90E8\u72B6\u6001"), /* @__PURE__ */ h("option", { value: "connected" }, "\u5DF2\u8FDE\u63A5"), /* @__PURE__ */ h("option", { value: "disabled" }, "\u5DF2\u505C\u7528"), /* @__PURE__ */ h("option", { value: "failed" }, "\u9700\u8981\u5904\u7406")), /* @__PURE__ */ h("div", { className: "hub-bulk" }, /* @__PURE__ */ h("button", { className: "hub-button", disabled: !!busy || !failures, onClick: restartFailed }, /* @__PURE__ */ h(Icon, { name: "refresh", size: 15 }), "\u91CD\u8FDE\u5F02\u5E38\u9879"), /* @__PURE__ */ h("button", { className: "hub-button", disabled: !data, onClick: () => {
    setExportError("");
    setExportOpen(true);
  } }, "\u5BFC\u51FA\u914D\u7F6E"))), /* @__PURE__ */ h("div", { className: "hub-list-label" }, /* @__PURE__ */ h("span", null, "\u670D\u52A1"), /* @__PURE__ */ h("span", null, "\u7BA1\u7406")), /* @__PURE__ */ h("div", { className: "hub-server-list" }, visible.map((server) => /* @__PURE__ */ h(ServerRow, { key: server.name, server, busy: !!busy, detail: toolDetails[server.name]?.tools && { tools: toolDetails[server.name].tools }, detailLoading: Boolean(toolDetails[server.name]?.loading), onLoadTools: loadTools, onEdit: (server2) => setDraft({ name: server2.name, entry: server2.entry, originalName: server2.name, auth: server2.oauth ? "oauth" : "token" }), onAction: action }))), !visible.length && /* @__PURE__ */ h("div", { className: "hub-empty" }, /* @__PURE__ */ h(Icon, { name: "box", size: 30 }), /* @__PURE__ */ h("h2", null, loading ? "\u6B63\u5728\u8BFB\u53D6\u670D\u52A1\u2026" : servers.length ? "\u6CA1\u6709\u5339\u914D\u7684\u670D\u52A1" : "\u8FDE\u63A5\u4F60\u7684\u7B2C\u4E00\u4E2A MCP"), /* @__PURE__ */ h("p", null, servers.length ? "\u8BD5\u8BD5\u5176\u4ED6\u540D\u79F0\u6216\u5207\u6362\u72B6\u6001\u7B5B\u9009\u3002" : "\u624B\u52A8\u6DFB\u52A0\u670D\u52A1\uFF0C\u6216\u4ECE\u5176\u4ED6 AI \u5E94\u7528\u5BFC\u5165\u5DF2\u6709\u914D\u7F6E\u3002"), !servers.length && !loading && /* @__PURE__ */ h("button", { className: "hub-button", onClick: () => setTab("import") }, /* @__PURE__ */ h(Icon, { name: "import" }), "\u4ECE\u672C\u673A\u5BFC\u5165"))) : /* @__PURE__ */ h(import_react2.default.Fragment, null, /* @__PURE__ */ h("div", { className: "hub-file-import" }, /* @__PURE__ */ h("span", null, "\u4ECE\u5176\u4ED6\u5E94\u7528\u5BFC\u5165\u5DF2\u6709 MCP"), /* @__PURE__ */ h("button", { className: "hub-button", disabled: scanning, onClick: () => fileInput.current.click() }, /* @__PURE__ */ h(Icon, { name: "folder", size: 16 }), "\u9009\u62E9\u914D\u7F6E\u6587\u4EF6"), /* @__PURE__ */ h("input", { type: "file", hidden: true, ref: fileInput, accept: ".json,.jsonc,.toml", onChange: readConfigFile })), /* @__PURE__ */ h(Sources, { sources, scanning, scanError, onScan: scan, onImport: (candidate) => setDraft({ ...candidate, candidateId: candidate.id }), onRemove: removeImportedSource }))), confirm && /* @__PURE__ */ h(DeleteDialog, { server: confirm, busy: !!busy, error: deleteError, onCancel: () => setConfirm(null), onDelete: () => action("remove", confirm, true) }), exportOpen && /* @__PURE__ */ h(ExportDialog, { busy: exportBusy, error: exportError, onCancel: () => {
    if (!exportBusy) setExportOpen(false);
  }, onExport: exportConfig }), draft && /* @__PURE__ */ h(Editor, { draft, existing: takenNames(servers), revision: data?.revision, request, reloadRevision: async () => (await refresh(true)).revision, onClose: () => setDraft(null), onSaved: async ({ result, names = [] }) => {
    const next = await refresh(true);
    const count = names.length;
    const label = count > 1 ? `${count} \u4E2A MCP \u670D\u52A1` : names[0] ?? "\u670D\u52A1";
    const verifying = Array.isArray(result.verifying) ? result.verifying.length > 0 : Boolean(result.verifying);
    const secrets = result.credentials?.stored?.length ? "\uFF08\u5BC6\u94A5\u5DF2\u5199\u5165 DSH \u51ED\u8BC1\uFF09" : "";
    if (result.ok || result.draft) {
      setDraft(null);
      notify(result.draft ? label + " \u5DF2\u4FDD\u5B58\uFF0C\u4FDD\u6301\u505C\u7528" + secrets : verifying ? label + " \u5DF2\u4FDD\u5B58\uFF0C\u6B63\u5728\u9A8C\u8BC1\u8FDE\u63A5" + secrets : label + " \u5DF2\u4FDD\u5B58" + secrets, result.draft ? "muted" : "good");
    }
    const warnings = (result.warnings ?? []).filter((item) => !String(item).startsWith("\u5DF2\u5199\u5165 DSH \u51ED\u8BC1\uFF1A"));
    if (warnings.length) setError(warnings.join("\uFF1B"));
    return next;
  } }));
}

// src/client/style.css
var style_default = '.mcp-hub{\n--hub-bg:var(--dsw-alias-bg-base,var(--hub-fallback-bg,#151517));\n--hub-panel:var(--dsw-alias-bg-layer-1,var(--hub-fallback-panel,#232324));\n--hub-raised:var(--dsw-alias-bg-layer-2,var(--hub-fallback-raised,#2c2c2e));\n--hub-line:var(--dsw-alias-border-l3,var(--hub-fallback-line,rgb(255 255 255 / 16%)));\n--hub-text:var(--dsw-alias-label-primary,var(--hub-fallback-text,#f9fafb));\n--hub-muted:var(--dsw-alias-label-secondary,var(--hub-fallback-muted,#cfd3d6));\n--hub-tertiary:var(--dsw-alias-label-tertiary,var(--hub-fallback-tertiary,#adb2b8));\n--hub-accent:var(--dsw-alias-brand-primary,var(--hub-fallback-text,#f9fafb));\n--hub-good:var(--dsw-alias-state-success-primary,#22c55e);\n--hub-bad:var(--dsw-alias-state-error-primary,var(--hub-fallback-bad,#f25a5a));\n--hub-warn:var(--dsw-alias-state-warn-primary,#f59e0b);\n--hub-on-primary:var(--dsw-alias-label-primary-foreground,var(--hub-fallback-on-primary,#0f1115));\n--hub-primary-hover:var(--dsw-alias-button-primary-hover,var(--hub-fallback-primary-hover,#ebeef2));\n--hub-hover:var(--dsw-alias-interactive-bg-hover,var(--hub-fallback-hover,rgb(255 255 255 / 8%)));\n--hub-link:var(--dsw-alias-link,var(--hub-fallback-link,#7aaaff));\n--hub-focus:var(--dsw-alias-state-business-primary,var(--hub-fallback-link,#7aaaff));\ncolor:var(--hub-text);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.5;width:100%;max-width:1040px;padding:26px 28px 0;margin:0 auto;box-sizing:border-box;isolation:isolate}\n.mcp-hub *{box-sizing:border-box}\n.mcp-hub button,.mcp-hub input,.mcp-hub textarea,.mcp-hub select{font:inherit}\n.mcp-hub button{cursor:pointer}\n.mcp-hub button:disabled{opacity:.4;cursor:not-allowed}\n.mcp-hub button{color:inherit}\n.mcp-hub button:focus-visible,.mcp-hub input:focus-visible,.mcp-hub textarea:focus-visible,.mcp-hub select:focus-visible,.mcp-hub summary:focus-visible{outline:2px solid var(--hub-focus);outline-offset:3px}\n.mcp-hub input,.mcp-hub textarea,.mcp-hub select{background:var(--hub-panel);border:1px solid var(--hub-line);border-radius:8px;color:var(--hub-text);padding:10px 12px;min-width:0}\n.mcp-hub textarea{resize:vertical}\n.mcp-hub input::placeholder,.mcp-hub textarea::placeholder{color:var(--hub-tertiary)}\n.mcp-hub code,.mcp-hub pre{font-family:"SFMono-Regular",Consolas,monospace;font-size:12px}\n.mcp-hub pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:var(--hub-panel);border:1px solid var(--hub-line);border-radius:8px;max-height:340px;overflow:auto}\n.mcp-hub p{margin:0}\n.mcp-hub h1,.mcp-hub h2{color:inherit}\n.mcp-hub h1{font-size:25px;line-height:1.2;font-weight:650;letter-spacing:-.8px;margin:2px 0 0}\n.mcp-hub h2{font-size:19px;letter-spacing:-.3px;margin:3px 0 8px}\n.hub-header{display:flex;justify-content:space-between;align-items:center;gap:20px}\n.hub-brand{display:flex;align-items:center;gap:11px}\n.hub-header-actions,.hub-actions{display:flex;align-items:center;gap:8px}\n.hub-description{color:var(--hub-muted);margin-top:11px!important;font-size:13px}\n.hub-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:33px;border:1px solid var(--hub-line);border-radius:8px;padding:6px 11px;background:var(--hub-raised);font-size:13px!important;white-space:nowrap;transition:background .15s,border-color .15s}\n.hub-button:hover:not(:disabled){background:var(--hub-hover);border-color:var(--hub-tertiary)}\n.hub-button.primary{background:var(--dsw-alias-button-primary-fill,var(--hub-accent));color:var(--hub-on-primary);border-color:transparent;font-weight:600}\n.hub-button.primary:hover:not(:disabled){background:var(--hub-primary-hover)}\n.hub-button.subtle{background:transparent;border-color:transparent;color:var(--hub-muted)}\n.hub-button.destructive{background:var(--hub-bad);color:#fff;border-color:transparent}\n.hub-icon-button{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid var(--hub-line);border-radius:8px;background:transparent;color:var(--hub-muted)!important;flex-shrink:0}\n.hub-icon-button:hover:not(:disabled){background:var(--hub-raised);color:var(--hub-text)!important}\n.hub-icon-button.danger:hover:not(:disabled){color:var(--hub-bad)!important;border-color:var(--hub-bad)}\n.hub-main-tabs{display:flex;align-items:center;gap:24px;border-bottom:1px solid var(--hub-line);margin-top:22px;margin-bottom:17px;min-height:42px}\n.hub-main-tabs>button{position:relative;background:none;border:0;display:flex;gap:7px;align-items:center;align-self:stretch;padding:0 2px 12px;font-size:13px;color:var(--hub-muted)}\n.hub-main-tabs>button.active{color:var(--hub-text);font-weight:600}\n.hub-main-tabs>button.active:after{content:"";position:absolute;bottom:-1px;left:0;right:0;height:2px;background:var(--hub-accent)}\n.hub-main-tabs small{background:var(--hub-raised);padding:0 6px;border-radius:4px;color:var(--hub-muted);font-size:10px}\n.hub-stats{display:flex;align-items:center;gap:0;margin-bottom:16px;color:var(--hub-muted)}\n.hub-stats>div{display:flex;gap:7px;align-items:center;padding:0 18px;border-right:1px solid var(--hub-line)}\n.hub-stats>div:first-child{padding-left:0}\n.hub-stats strong{font-size:17px;font-weight:600;color:var(--hub-text)}\n.hub-stats span{font-size:12px}\n.hub-stats i,.hub-small-dot{width:6px;height:6px;border-radius:100%;display:inline-block;background:currentColor}\n.hub-toolbar{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}\n.hub-bulk{display:flex;gap:8px;margin-left:auto}\n@media(max-width:720px){.hub-bulk{margin-left:0;width:100%;justify-content:flex-end}}\n.hub-search{position:relative;display:flex;align-items:center;flex:1;color:var(--hub-muted)}\n.hub-search>svg{position:absolute;left:13px;pointer-events:none}\n.hub-search>input{width:100%;padding-left:37px;height:36px;background:transparent}\n.hub-toolbar>select{background:transparent;min-width:125px;font-size:12px;padding-right:27px}\n.hub-list-label{display:flex;justify-content:space-between;font-size:10px;color:var(--hub-muted);margin-bottom:8px;padding:0 18px;letter-spacing:1px}\n.hub-server-list{display:flex;flex-direction:column;gap:8px}\n.hub-server{background:var(--hub-panel);border:1px solid var(--hub-line);border-radius:10px;overflow:hidden}\n.hub-server-top{display:flex;align-items:center;gap:11px;padding:14px 16px 14px 10px;min-height:80px}\n.hub-expand-button{width:24px;height:32px;display:grid;place-items:center;background:transparent;border:0;color:var(--hub-muted)!important;flex-shrink:0;padding:0}\n.hub-avatar{height:35px;width:35px;display:grid;place-items:center;flex-shrink:0;background:var(--hub-raised);border:1px solid var(--hub-line);color:var(--hub-text);border-radius:9px;font-size:16px;font-weight:600}\n.hub-server-name{flex:1;min-width:0;background:none;border:0;text-align:left;padding:0;display:flex;flex-direction:column;gap:5px}\n.hub-server-name>strong{font-size:15px;font-weight:600;overflow-wrap:anywhere;letter-spacing:-.1px}\n.hub-server-name>span{display:flex;align-items:center;gap:9px;flex-wrap:wrap}\n.hub-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap}\n.hub-status i{width:6px;height:6px;background:currentColor;border-radius:100%}\n.mcp-hub .good{color:var(--hub-good)}\n.mcp-hub .bad{color:var(--hub-bad)}\n.mcp-hub .warn{color:var(--hub-warn)}\n.mcp-hub .muted{color:var(--hub-muted)}\n.hub-badge{display:inline-flex;align-items:center;border-radius:4px;background:var(--hub-raised);padding:1px 6px;color:var(--hub-muted);font-size:10px;white-space:nowrap}\n.hub-origin{color:var(--hub-muted);font-size:10px}\n.hub-note{display:inline-flex;align-items:center;gap:5px;font-size:10px;line-height:1.6;max-width:100%;overflow-wrap:anywhere}\n.hub-note>.hub-spinner{width:11px;height:11px;border-width:1.5px}\n.hub-switch{width:37px;height:22px;background:var(--hub-line);border:0;border-radius:20px;padding:3px;display:flex;align-items:center;margin-left:7px;flex-shrink:0}\n.hub-switch>span{height:16px;width:16px;border-radius:100%;background:var(--dsw-alias-switch-thumb,var(--hub-tertiary));transition:transform .18s}\n.hub-switch[aria-checked=true]{background:var(--hub-accent)}\n.hub-switch[aria-checked=true]>span{background:var(--hub-on-primary);transform:translateX(15px)}\n.hub-server-details{border-top:1px solid var(--hub-line);padding:0 20px 20px 56px}\n.hub-detail-tabs{display:flex;gap:23px;border-bottom:1px solid var(--hub-line);margin-bottom:18px}\n.hub-detail-tabs button{background:none;border:0;padding:13px 0 10px;font-size:12px;color:var(--hub-muted)}\n.hub-detail-tabs button.active{color:var(--hub-accent);border-bottom:1px solid var(--hub-accent)}\n.hub-detail-tabs small{font-size:10px;margin-left:5px;color:var(--hub-muted)}\n.hub-detail-heading{display:flex;justify-content:space-between;align-items:center;color:var(--hub-muted);font-size:11px;margin-bottom:12px}\n.hub-detail-heading input{padding:5px 9px;font-size:11px}\n.hub-tool{border-top:1px solid var(--hub-line);padding:11px 0}\n.hub-tool summary{list-style:none;display:flex;align-items:center;gap:9px;cursor:pointer;color:var(--hub-text)}\n.hub-tool summary::-webkit-details-marker{display:none}\n.hub-tool summary>svg:last-child{margin-left:auto;color:var(--hub-muted)}\n.hub-tool[open] summary>svg:last-child{transform:rotate(90deg)}\n.hub-tool p{color:var(--hub-muted);font-size:12px;line-height:1.7;margin:10px 0!important}\n.hub-definition{display:grid;grid-template-columns:80px 1fr;gap:11px;font-size:12px;overflow-wrap:anywhere}\n.hub-definition>span{color:var(--hub-muted)}\n.hub-definition strong{font-weight:400}\n.hub-diagnostics{line-height:1.8;font-size:12px}\n.hub-diagnostics p{color:var(--hub-muted);margin:12px 0!important;overflow-wrap:anywhere}\n.hub-help{font-size:11px;color:var(--hub-muted);line-height:1.7}\n.hub-empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:55px 15px 70px;gap:15px;color:var(--hub-muted)}\n.hub-empty h2{color:var(--hub-text);margin:0}\n.hub-empty p{font-size:13px;line-height:1.9}\n.hub-empty-icon{height:64px;width:64px;display:grid;place-items:center;background:var(--hub-panel);border:1px solid var(--hub-line);color:var(--hub-text);border-radius:17px;margin-bottom:7px}\n.hub-source-list{display:flex;flex-direction:column;gap:12px}\n.hub-source{border:1px solid var(--hub-line);border-radius:11px;overflow:hidden}\n.hub-source-heading{display:flex;align-items:center;gap:11px;width:100%;padding:18px;background:transparent;border:0;text-align:left}\n.hub-source-heading>svg{flex-shrink:0;color:var(--hub-muted)}\n.hub-source-logo{height:29px;width:29px;display:grid;place-items:center;border-radius:7px;background:var(--hub-raised);color:var(--hub-text);font-size:16px;font-weight:650;flex-shrink:0}\n.hub-source-heading>strong{font-size:14px;white-space:nowrap;max-width:min(340px,42vw);min-width:0;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}\n.hub-source-heading>code{margin-left:auto;font-size:10px;color:var(--hub-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:min(300px,34vw);min-width:0;flex:0 1 auto}\n.hub-source-content{border-top:1px solid var(--hub-line);padding:0 19px 0 58px}\n.hub-source-content>.hub-help{padding:20px 0}\n.hub-candidate{display:flex;align-items:center;gap:12px;padding:17px 0;border-bottom:1px solid var(--hub-line)}\n.hub-candidate:last-child{border-bottom:0}\n.hub-candidate-icon{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:var(--hub-raised);color:var(--hub-muted);flex-shrink:0}\n.hub-candidate-info{flex:1;display:flex;flex-direction:column;gap:5px;min-width:0}\n.hub-candidate-info>strong{font-size:13px;font-weight:500}\n.hub-candidate-info>span{font-size:10px;color:var(--hub-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.hub-candidate-info i{font-style:normal;padding:0 7px}\n.hub-candidate-info>small{font-size:10px;color:var(--hub-muted)}\n.hub-already{font-size:10px;color:var(--hub-good);display:flex;align-items:center;gap:5px}\n.hub-banner{display:flex;align-items:center;gap:9px;padding:12px 14px;border:1px solid var(--hub-line);border-radius:8px;margin:12px 0;font-size:12px;line-height:1.7;overflow-wrap:anywhere}\n.hub-banner>span{flex:1}\n.hub-banner.bad{background:color-mix(in srgb,var(--hub-bad) 10%,transparent);border-color:color-mix(in srgb,var(--hub-bad) 35%,transparent)}\n.hub-banner.warn{background:color-mix(in srgb,var(--hub-warn) 10%,transparent);border-color:color-mix(in srgb,var(--hub-warn) 35%,transparent)}\n.hub-banner.good{background:color-mix(in srgb,var(--hub-good) 10%,transparent);border-color:color-mix(in srgb,var(--hub-good) 35%,transparent)}\n.hub-row-oauth{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 16px 12px 46px;padding:8px 12px;border:1px solid color-mix(in srgb,var(--hub-accent) 32%,transparent);border-radius:8px;background:color-mix(in srgb,var(--hub-accent) 8%,transparent);color:var(--hub-muted);font-size:12px;line-height:1.6}\n.hub-row-oauth>span{flex:1;min-width:140px}\n.hub-row-oauth .hub-text-button{font-size:12px!important}\n.hub-text-button{border:0;background:transparent;padding:3px;font-size:11px!important;color:var(--hub-link)!important;white-space:nowrap}\n.hub-delete-confirm{display:flex;align-items:center;gap:8px;border:1px solid var(--hub-bad);border-radius:8px;padding:12px 15px;font-size:12px}\n.hub-delete-confirm>span{flex:1}\n.hub-overlay{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.5));z-index:1000;display:flex;align-items:center;justify-content:center;padding:18px}\n.hub-dialog{display:flex;flex-direction:column;max-height:calc(100dvh - 36px);width:680px;max-width:100%;background:var(--hub-bg);border:1px solid var(--hub-line);border-radius:16px;box-shadow:0 25px 100px #0005;overflow:hidden}\n.hub-dialog-header{display:flex;justify-content:space-between;align-items:center;padding:23px 27px 19px;border-bottom:1px solid var(--hub-line)}\n.hub-dialog-header h2{margin:5px 0 0;font-size:20px}\n.hub-dialog-body{padding:23px 27px;overflow-y:auto;overscroll-behavior:contain}\n.hub-dialog-footer{border-top:1px solid var(--hub-line);padding:17px 23px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}\n.hub-dialog-footer>.hub-help{font-size:10px}\n.hub-fields{margin:0;padding:0;border:0;min-width:0;display:flex;flex-direction:column;gap:19px}\n.hub-field{display:flex;flex-direction:column;gap:7px;font-size:12px;color:var(--hub-text)}\n.hub-field small{font-size:10px;color:var(--hub-muted);line-height:1.6}\n.hub-field input,.hub-field select,.hub-field textarea{width:100%;font-size:12px}\n.hub-field textarea{font-family:monospace}\n.hub-optional{font-size:10px;color:var(--hub-muted);display:contents}\n.hub-field-caption{display:flex;align-items:center;justify-content:space-between;font-size:12px;margin-bottom:9px}\n.hub-pair{display:flex;gap:7px;align-items:center;margin-top:7px}\n.hub-pair>input{font-size:11px;padding:9px;width:32%}\n.hub-pair>input:nth-of-type(2){flex:1;width:auto}\n.hub-pair>span{color:var(--hub-muted)}\n.hub-pair>.hub-icon-button{width:26px;height:29px;border:0}\n.hub-source-note{display:flex;gap:11px;background:var(--hub-panel);border:1px solid var(--hub-line);padding:13px 15px;border-radius:8px;color:var(--hub-accent);margin-bottom:20px;font-size:12px}\n.hub-source-note>div{display:flex;flex-direction:column;gap:5px;min-width:0}\n.hub-source-note code{font-size:10px;color:var(--hub-muted);display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.hub-source-note small{font-size:10px;color:var(--hub-muted)}\n.hub-editor-modes{display:flex;gap:19px;border-bottom:1px solid var(--hub-line);margin-bottom:20px}\n.hub-editor-modes button{border:0;background:none;color:var(--hub-muted);padding:0 0 10px;font-size:12px}\n.hub-editor-modes button.active{color:var(--hub-accent);border-bottom:1px solid var(--hub-accent)}\n.hub-json-editor{min-height:280px}\n.hub-json-editor::placeholder{color:var(--hub-tertiary);opacity:.5}\n.hub-json-rename-hint{font-size:11px;margin-top:7px}\n.hub-checks:not(:empty){border:1px solid var(--hub-line);border-radius:8px;padding:6px 15px;margin-top:23px;background:var(--hub-panel)}\n.hub-check{display:flex;gap:10px;align-items:flex-start;padding:10px 0}\n.hub-check>div{min-width:0}\n.hub-check strong{font-size:11px;font-weight:500;color:var(--hub-text)}\n.hub-check p{color:var(--hub-muted);font-size:10px;overflow-wrap:anywhere;margin-top:3px}\n.hub-check-symbol{display:grid;place-items:center;width:18px;height:18px;border:1px solid currentColor;border-radius:100%;font-size:10px;flex-shrink:0;margin-top:1px}\n.hub-spinner{width:17px;height:17px;border:2px solid var(--hub-line);border-top-color:var(--hub-accent);border-radius:100%;animation:hub-spin 1s linear infinite;flex-shrink:0}\n.hub-compatibility{border:1px solid color-mix(in srgb,var(--hub-warn) 40%,transparent);border-radius:8px;background:color-mix(in srgb,var(--hub-warn) 10%,transparent);padding:13px 15px;color:var(--hub-warn);font-size:11px}\n.hub-compatibility strong{font-weight:500}\n.hub-compatibility ul{padding-left:16px;line-height:1.8}\n.hub-compatibility label{display:flex;align-items:center;gap:7px}\n.hub-compatibility input{accent-color:var(--hub-accent)}\n.rotated{transform:rotate(90deg)}\n.spinning{animation:hub-spin 1s linear infinite}\n@keyframes hub-spin{to{transform:rotate(360deg)}\n}\nbody:has(.mcp-hub[data-preview=true]){margin:0;background:#151517;min-width:360px}\n.mcp-hub[data-preview=true]{padding-top:22px;max-width:1040px;min-height:100vh}\n@media(max-width:720px){.mcp-hub{padding:22px 15px 0}\n.hub-header{gap:10px}\n.mcp-hub h1{font-size:22px}\n.hub-header-actions>.hub-icon-button{display:none}\n.hub-main-tabs{gap:20px}\n.hub-stats>div{padding:0 11px}\n.hub-stats>div:first-child{padding-left:0}\n.hub-server-top{gap:9px;padding:16px 12px 16px 7px;flex-wrap:wrap}\n.hub-server-name>strong{font-size:14px}\n.hub-server-name>span{gap:5px}\n.hub-server-top>.hub-actions{margin-left:81px}\n.hub-server-details{padding:0 15px 18px 22px}\n.hub-source-heading{gap:8px;padding:15px 12px;flex-wrap:wrap}\n.hub-source-heading>code{order:2;max-width:100%;width:100%;margin-left:50px}\n.hub-source-heading>.hub-source-content{padding:0 15px 0 24px}\n.hub-candidate-info>span{max-width:190px}\n.hub-overlay{padding:10px}\n.hub-dialog{max-height:calc(100dvh - 20px)}\n.hub-dialog-body{padding:18px}\n.hub-dialog-header{padding:18px}\n.hub-dialog-footer{padding:13px;justify-content:flex-end}\n.hub-dialog-footer>.hub-help{display:none}\n.hub-dialog-footer .hub-actions{gap:5px}\n.hub-dialog-footer .hub-button{font-size:11px!important;padding:8px}\n.hub-pair{flex-wrap:wrap}\n.hub-pair>input{width:38%}\n.hub-pair>input:nth-of-type(2){min-width:90px}\n.hub-delete-confirm{display:flex;align-items:center;gap:8px;border:1px solid var(--hub-bad);border-radius:8px;padding:12px 15px;font-size:12px}\n.hub-delete-confirm>span{flex-basis:100%}\n}\n.hub-file-import{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px;color:var(--hub-muted);font-size:11px}\n.hub-file-import>input[hidden]{display:none}\n@media(max-width:720px){.hub-file-import{align-items:flex-start}\n.hub-file-import>span{max-width:55%;line-height:1.8}\n}\n@media(prefers-reduced-motion:reduce){.mcp-hub *{animation:none!important;transition:none!important}\n}\n\n\n/* Official variables take precedence; fallbacks also support standalone previews. */\n@media(prefers-color-scheme:light){.mcp-hub{--hub-fallback-bg:#fff;--hub-fallback-panel:#fff;--hub-fallback-raised:#f1f3f5;--hub-fallback-line:rgb(0 0 0 / 16%);--hub-fallback-text:#353638;--hub-fallback-muted:#61666b;--hub-fallback-tertiary:#81858c;--hub-fallback-on-primary:#fff;--hub-fallback-hover:rgb(0 0 0 / 5%);--hub-fallback-primary-hover:#2c2c2e;--hub-fallback-link:#4176e6;--hub-fallback-bad:#ef4444}}\nhtml[data-ds-theme-source] body:not([data-ds-dark-theme]) .mcp-hub{--hub-fallback-bg:#fff;--hub-fallback-panel:#fff;--hub-fallback-raised:#f1f3f5;--hub-fallback-line:rgb(0 0 0 / 16%);--hub-fallback-text:#353638;--hub-fallback-muted:#61666b;--hub-fallback-tertiary:#81858c;--hub-fallback-on-primary:#fff;--hub-fallback-hover:rgb(0 0 0 / 5%);--hub-fallback-primary-hover:#2c2c2e;--hub-fallback-link:#4176e6;--hub-fallback-bad:#ef4444}\nbody[data-ds-dark-theme] .mcp-hub{--hub-fallback-bg:#151517;--hub-fallback-panel:#232324;--hub-fallback-raised:#2c2c2e;--hub-fallback-line:rgb(255 255 255 / 16%);--hub-fallback-text:#f9fafb;--hub-fallback-muted:#cfd3d6;--hub-fallback-tertiary:#adb2b8;--hub-fallback-on-primary:#0f1115;--hub-fallback-hover:rgb(255 255 255 / 8%);--hub-fallback-primary-hover:#ebeef2;--hub-fallback-link:#7aaaff;--hub-fallback-bad:#f25a5a}\nhtml[data-ds-theme-source=light] body:has(.mcp-hub[data-preview=true]){background:#fff}\n.mcp-hub{padding-bottom:34px}\n\n.hub-confirm-dialog{width:460px}\n.hub-peeked{border-color:var(--hub-link)!important;background:color-mix(in srgb,var(--hub-link) 12%,transparent)!important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}\n.hub-renew-dialog{width:460px}\n.hub-confirm-dialog .hub-dialog-header h2{font-size:18px;margin:0}\n.hub-confirm-dialog .hub-dialog-body{line-height:1.9}\n.hub-confirm-dialog .hub-dialog-footer{justify-content:flex-end}\n.hub-toast{display:flex;align-items:center;gap:10px;width:fit-content;max-width:100%;margin:0 0 12px;padding:9px 10px 9px 14px;background:var(--hub-panel);border:1px solid var(--hub-line);border-radius:8px;font-size:12px}\n.hub-toast>span{color:var(--hub-text)}\n.hub-toast .hub-icon-button{border:0;width:26px;height:26px}\n.hub-variable-row{margin:10px 0}\n.hub-variable-row>.hub-pair{display:grid;grid-template-columns:minmax(100px,.9fr) 112px minmax(110px,1fr) auto;align-items:center;gap:7px}\n.hub-row-actions{display:flex;align-items:center;gap:2px;justify-self:end}\n.hub-row-actions .hub-icon-button{width:26px;height:29px;border:0}\n.hub-variable-row .hub-pair input{width:100%;min-width:0}\n.hub-variable-row .hub-pair select{width:100%;padding:9px 5px;font-size:10px}\n.hub-variable-row>small{display:block;margin-top:5px;font-size:10px;line-height:1.6}\n.hub-argument{display:flex;align-items:center;gap:8px;margin:8px 0}\n.hub-argument>span{font:11px monospace;color:var(--hub-tertiary);width:16px;text-align:center}\n.hub-argument>input{flex:1;width:100%;font:12px monospace}\n.hub-argument>.hub-icon-button{border:0}\n.hub-enable-field{display:flex;align-items:center;gap:9px;margin-top:22px;font-size:12px}\n.hub-enable-field input{accent-color:var(--hub-accent)}\n.hub-enable-field span{margin-left:auto}\n@media(max-width:720px){.hub-variable-row>.hub-pair{grid-template-columns:minmax(80px,1fr) 96px auto}.hub-variable-row .hub-pair>input:nth-of-type(2){grid-row:2;grid-column:1/3}.hub-variable-row .hub-row-actions{grid-row:1;grid-column:3}.hub-toast{margin-bottom:8px}.hub-enable-field{flex-wrap:wrap}}\n\n.mcp-hub button>svg{display:block;flex-shrink:0;transform-origin:center}\n.hub-json-config{display:flex;flex-direction:column;gap:12px}\n\n.hub-willwrite{margin:0 0 18px;border:1px solid var(--hub-line);border-radius:8px;padding:10px 14px;background:var(--hub-panel)}\n.hub-willwrite>summary{cursor:pointer;font-size:12px;color:var(--hub-link)}\n.hub-willwrite>ul{margin:10px 0 0;padding-left:16px;font-size:11px;line-height:1.9}\n.hub-willwrite>ul>li>code{margin-right:6px;color:var(--hub-text)}\n.hub-willwrite>ul>li>span{color:var(--hub-muted);overflow-wrap:anywhere}\n.hub-willwrite>pre{margin:10px 0 0;max-height:220px}\n\n.hub-source-heading-row{display:flex;align-items:center;gap:4px;border-bottom:1px solid transparent}\n.hub-source-heading-row>.hub-source-heading{flex:1;min-width:0}\n.hub-source-heading-row>.hub-icon-button{flex-shrink:0;margin-right:10px}\n.hub-json-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap}\n.hub-json-toolbar .hub-json-format{width:180px;margin:0}\n.hub-json-toolbar .hub-json-format select{width:100%}\n.hub-dirty-dot{display:inline-block;width:6px;height:6px;margin-left:6px;border-radius:50%;background:var(--hub-link);vertical-align:middle}\n.hub-json-rows{display:flex;flex-direction:column;gap:9px;margin:4px 0 2px}\n.hub-json-row{border:1px solid var(--hub-line);border-left:3px solid var(--hub-line);border-radius:8px;padding:11px 13px;background:var(--hub-panel)}\n.hub-json-row.passed{border-left-color:var(--hub-good,#22c55e)}\n.hub-json-row.warn{border-left-color:var(--hub-warn,#f59e0b)}\n.hub-json-row.failed{border-left-color:var(--hub-bad)}\n.hub-json-row.duplicate{background:var(--hub-raised)}\n.hub-json-row.conflict{border-left-color:var(--hub-bad)}\n.hub-json-row-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap}\n.hub-json-row-head>strong{font-size:13px;color:var(--hub-text);overflow-wrap:anywhere}\n.hub-json-row-meta{display:flex;align-items:center;gap:6px;margin:6px 0;font-size:11px;color:var(--hub-muted);min-width:0}\n.hub-json-row-meta>code{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}\n.hub-json-rename{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:11px;color:var(--hub-muted);flex-wrap:wrap}\n.hub-json-rename>input{flex:1;min-width:150px;padding:7px 9px;font:12px monospace}\n.hub-json-issues{margin:8px 0;padding:8px 10px;border:1px solid var(--hub-warn,#f59e0b);border-radius:6px;font-size:11px;line-height:1.7}\n.hub-json-issues>p{margin:0 0 6px;color:var(--hub-text)}\n.hub-json-issues>label{display:flex;align-items:flex-start;gap:7px;color:var(--hub-muted);cursor:pointer}\n.hub-json-row-actions{display:flex;align-items:center;gap:12px;margin-top:4px}\n.hub-json-row-actions>.hub-text-button{margin-left:auto}\n.hub-json-row-actions>.hub-text-button.danger{color:var(--hub-bad)!important}\n.hub-test-note{margin:6px 0;font-size:11px;line-height:1.7;color:var(--hub-muted);flex:1;min-width:0;overflow-wrap:anywhere}\n.hub-test-note.passed{color:var(--hub-good,#22c55e)}\n.hub-test-note.warn{color:var(--hub-warn,#f59e0b)}\n.hub-test-note.failed{color:var(--hub-bad)}\n.hub-json-row>.bad{margin:6px 0 2px;font-size:11px;line-height:1.7}\n@media(max-width:720px){.hub-json-toolbar .hub-json-format{width:100%}.hub-json-row-actions{flex-wrap:wrap}.hub-json-row-actions>.hub-text-button{margin-left:0}}\n\n/* Compact pass: mirror the DSH settings page proportions (18px heading, 13px body, 760\u2013800px content). */\n.mcp-hub,.mcp-hub[data-preview=true]{max-width:800px;padding:18px 20px 0;font-size:12.5px}\n.mcp-hub h1{font-size:20px;letter-spacing:-.5px}\n.hub-brand{gap:9px}\n.hub-description{font-size:12px;margin-top:7px!important}\n.hub-button{min-height:30px;padding:5px 10px;font-size:12px!important;gap:6px}\n.hub-icon-button{width:28px;height:28px}\n.hub-main-tabs{gap:18px;margin-top:16px;margin-bottom:12px;min-height:34px}\n.hub-main-tabs>button{padding:0 1px 9px;font-size:12px;gap:6px}\n.hub-main-tabs small{font-size:9px;padding:0 5px}\n.hub-stats{margin-bottom:12px}\n.hub-stats>div{gap:6px;padding:0 14px}\n.hub-stats strong{font-size:15px}\n.hub-stats span{font-size:11.5px}\n.hub-toolbar{gap:8px;margin-bottom:10px}\n.hub-search>svg{left:11px}\n.hub-search>input{height:32px;padding-left:34px;font-size:12px}\n.hub-toolbar>select{min-width:118px;font-size:11.5px;padding:7px 24px 7px 9px;height:32px}\n.hub-list-label{font-size:9.5px;margin-bottom:6px;padding:0 13px;letter-spacing:.6px}\n.hub-server-list{gap:7px}\n.hub-server-top{min-height:64px;padding:10px 12px 10px 8px;gap:9px}\n.hub-avatar{width:30px;height:30px;font-size:14px;border-radius:8px}\n.hub-server-name{gap:3px}\n.hub-server-name>strong{font-size:14px}\n.hub-status{font-size:11px;gap:5px}\n.hub-server-top>.hub-actions{gap:5px}\n.hub-file-import{margin-bottom:16px;font-size:12px}\n.hub-source-list{gap:9px}\n.hub-source{border-radius:9px}\n.hub-source-heading{padding:12px 14px;gap:9px}\n.hub-source-logo{width:26px;height:26px;border-radius:7px;font-size:14px}\n.hub-source-heading>strong{font-size:13px}\n.hub-source-content{padding:0 14px 0 44px}\n.hub-candidate{padding:11px 0;gap:10px}\n.hub-candidate-icon{width:28px;height:28px;border-radius:7px}\n.hub-candidate-info{gap:3px}\n.hub-candidate-info>strong{font-size:12.5px}\n.hub-dialog{width:620px;border-radius:14px}\n.hub-dialog-header{padding:18px 22px 14px}\n.hub-dialog-header h2{font-size:18px}\n.hub-dialog-body{padding:18px 22px}\n.hub-dialog-footer{padding:12px 18px}\n.hub-fields{gap:14px}\n@media(max-width:720px){.mcp-hub{padding:16px 14px 0;max-width:none}.mcp-hub h1{font-size:19px}.hub-server-top{min-height:60px;padding:10px 9px 10px 6px}.hub-server-top>.hub-actions{margin-left:0}.hub-dialog{width:100%}}\n\n/* Compact test result: one colored summary, details only on demand. */\n.hub-test-status{display:flex;gap:9px;align-items:flex-start;border:1px solid var(--hub-line);border-left:3px solid var(--hub-muted);border-radius:8px;padding:10px 12px;margin-top:14px;background:var(--hub-panel)}\n.hub-test-status.good{border-left-color:var(--hub-good);background:color-mix(in srgb,var(--hub-good) 6%,var(--hub-panel))}\n.hub-test-status.warn{border-left-color:var(--hub-warn);background:color-mix(in srgb,var(--hub-warn) 6%,var(--hub-panel))}\n.hub-test-status.bad{border-left-color:var(--hub-bad);background:color-mix(in srgb,var(--hub-bad) 6%,var(--hub-panel))}\n.hub-test-icon{display:grid;place-items:center;width:20px;height:20px;flex-shrink:0;margin-top:1px;border-radius:100%;color:var(--hub-good);background:color-mix(in srgb,var(--hub-good) 14%,transparent)}\n.hub-test-status.warn .hub-test-icon{color:var(--hub-warn);background:color-mix(in srgb,var(--hub-warn) 14%,transparent)}\n.hub-test-status.bad .hub-test-icon{color:var(--hub-bad);background:color-mix(in srgb,var(--hub-bad) 14%,transparent)}\n.hub-test-status.testing .hub-test-icon{background:transparent}\n.hub-test-status.testing .hub-test-icon .hub-spinner{width:15px;height:15px;border-width:1.5px}\n.hub-test-copy{flex:1;min-width:0}\n.hub-test-copy>strong{display:block;font-size:12.5px;font-weight:600;line-height:1.4;color:var(--hub-text)}\n.hub-test-copy>p{margin-top:2px;font-size:11.5px;line-height:1.55;color:var(--hub-muted);overflow-wrap:anywhere}\n.hub-test-status.bad .hub-test-copy>p{color:var(--hub-bad)}\n.hub-test-status.warn .hub-test-copy>p{color:var(--hub-warn)}\n.hub-test-details{margin-top:4px}\n.hub-test-details>summary{cursor:pointer;font-size:10.5px;color:var(--hub-muted)}\n.hub-check-list{margin-top:5px;padding-top:2px;border-top:1px solid var(--hub-line)}\n.hub-check-list .hub-check{padding:6px 0;gap:7px}\n.hub-check-list .hub-check strong{font-size:10.5px}\n.hub-check-list .hub-check p{margin-top:2px;font-size:10px;line-height:1.55}\n.hub-check-list .hub-check-symbol{width:14px;height:14px;font-size:9px;margin-top:0}\n\n/* Environment variables use one direct value field; headers keep the reference modes. */\n.hub-variable-row>.hub-pair.no-mode{grid-template-columns:minmax(110px,.9fr) minmax(130px,1fr) auto}\n@media(max-width:720px){.hub-variable-row>.hub-pair.no-mode{grid-template-columns:minmax(80px,1fr) auto}.hub-variable-row>.hub-pair.no-mode>input:nth-of-type(2){grid-row:2;grid-column:1/2}}\n\n.hub-export-dialog{width:520px}\n.hub-export-options{display:grid;gap:8px;margin:14px 0}\n.hub-export-option{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--hub-line);border-radius:8px;cursor:pointer}\n.hub-export-option:has(input:checked){border-color:var(--hub-accent);background:color-mix(in srgb,var(--hub-accent) 7%,transparent)}\n.hub-export-option input{margin:3px 0 0}\n.hub-export-option span{display:grid;gap:3px}\n.hub-export-option strong{font-size:13px}\n.hub-export-option small{font-size:12px;line-height:1.6;color:var(--hub-muted)}\n.hub-export-dialog .hub-banner{margin-top:2px}\n\n.hub-dialog.hub-confirm-dialog{width:460px}\n\n.hub-brand-title{display:flex;align-items:center;gap:10px;min-width:0;flex-wrap:wrap}\n.hub-repo-links{display:flex;align-items:center;gap:6px;flex-wrap:wrap}\n.hub-github-link{display:inline-flex;align-items:center;gap:5px;color:var(--hub-muted);font-size:12px;text-decoration:none;border:1px solid var(--hub-line);border-radius:8px;padding:5px 9px;line-height:1;transition:color .15s,border-color .15s,background .15s}\n.hub-github-link:hover{color:var(--hub-text);border-color:var(--hub-muted);background:var(--hub-raised)}\n.hub-github-link:focus-visible{outline:2px solid var(--hub-accent);outline-offset:2px}\n\n/* Official MCP Registry: search, inspect, then prefill the normal editor. */\n.hub-catalog-search{display:flex;gap:8px;align-items:center;margin-bottom:8px}\n.hub-catalog-search-box{flex:1}\n.hub-catalog-hint{display:flex;align-items:flex-start;gap:7px;color:var(--hub-tertiary);font-size:11px;line-height:1.6;margin:0 0 14px}\n.hub-catalog-hint svg{flex-shrink:0;margin-top:1px}\n.hub-catalog-list{display:flex;flex-direction:column;gap:6px}\n.hub-catalog-card{display:flex;align-items:center;gap:12px;border:1px solid var(--hub-line);border-radius:10px;background:var(--hub-panel);padding:10px 12px}\n.hub-catalog-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}\n.hub-catalog-card-head>div{display:flex;flex-direction:column;gap:3px;min-width:0}\n.hub-catalog-content{min-width:0;flex:1}.hub-catalog-card-head strong{font-size:13px;font-weight:600;overflow-wrap:anywhere}\n.hub-catalog-card-head code{font-size:10px;color:var(--hub-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}\n.hub-catalog-description{margin-top:4px!important;color:var(--hub-muted);font-size:11px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}\n.hub-catalog-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:6px}\n.hub-catalog-updated{margin-left:auto;color:var(--hub-tertiary);font-size:10px;white-space:nowrap}\n.hub-catalog-card-actions{display:flex;align-items:center;gap:5px;flex-shrink:0}.hub-catalog-card-actions .hub-icon-button{width:28px;height:28px;border-radius:7px;color:var(--hub-muted)!important}.hub-catalog-card-actions .hub-icon-button:hover:not(:disabled){color:var(--hub-text)!important;border-color:var(--hub-muted);background:var(--hub-raised)}\n.hub-catalog-loadmore{display:flex;justify-content:center;margin:14px 0 4px}\n.hub-catalog-sentinel{display:flex;align-items:center;justify-content:center;height:34px;color:var(--hub-tertiary);font-size:10.5px}\n.hub-catalog-dialog{width:640px}\n.hub-catalog-title-row{display:flex;align-items:center;gap:10px;min-width:0}\n.hub-catalog-title-row>div{display:flex;flex-direction:column;gap:3px;min-width:0}\n.hub-catalog-icon{width:38px;height:38px;border-radius:9px;object-fit:contain;background:var(--hub-raised);border:1px solid var(--hub-line);flex-shrink:0}\n.hub-catalog-dialog .hub-dialog-header h2{margin:0;font-size:17px}\n.hub-catalog-registry-name{font-size:10px;color:var(--hub-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}\n.hub-catalog-section-title{font-size:12px;font-weight:600;margin:16px 0 8px}\n.hub-catalog-options{display:grid;gap:7px}\n.hub-catalog-option{display:flex;align-items:flex-start;gap:9px;padding:8px 10px;border:1px solid var(--hub-line);border-radius:8px}\n.hub-catalog-option>span{display:flex;flex-direction:column;gap:3px;min-width:0}\n.hub-catalog-option strong{font-size:12px;font-weight:600}\n.hub-catalog-option small{font-size:10.5px;color:var(--hub-muted);line-height:1.5;overflow-wrap:anywhere}\n.hub-catalog-option code{font-size:10.5px}\n.hub-catalog-entry{margin-top:11px}\n.hub-catalog-entry-title{font-size:11px;font-weight:600;color:var(--hub-muted);margin:0 0 6px}\n.hub-catalog-entry pre{margin-top:7px;max-height:220px;font-size:10.5px}\n@media(max-width:720px){.hub-catalog-dialog{width:100%}.hub-catalog-card{align-items:stretch;flex-direction:column;gap:8px}.hub-catalog-card-actions{justify-content:flex-end}.hub-catalog-search{flex-wrap:wrap}.hub-catalog-search-box{flex-basis:100%}.hub-catalog-search>.hub-button{width:100%}}\n.hub-auth-options{display:flex;flex-wrap:nowrap;gap:20px;font-size:13px;white-space:nowrap}\n.hub-auth-options label{display:inline-flex;flex:0 0 auto;align-items:center;gap:6px;cursor:pointer}\n.hub-hint{margin:6px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-text-secondary,#6b7280)}\n.hub-row-auth{height:29px;padding:0 10px;font-size:12px}\n';

// src/client/plugin.jsx
var inject = ["slots", "locale"];
function apply(ctx) {
  setLocale(ctx.locale.getSnapshot().active);
  ctx.effect(() => ctx.locale.subscribe(() => setLocale(ctx.locale.getSnapshot().active)), "MCP Hub locale");
  ctx.effect(() => {
    const style = document.createElement("style");
    style.textContent = style_default;
    document.head.append(style);
    return () => style.remove();
  });
  ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "dsh-mcp-hub", order: 36, label: () => "MCP Hub" }, () => /* @__PURE__ */ import_react3.default.createElement(App, { locale: ctx.locale }))), "MCP Hub settings");
  ctx.effect(() => ctx.slots.inject("settings.section.icon", () => ctx.slots.register({ name: "settings.section.icon", id: "dsh-mcp-hub", order: 36 }, (props) => /* @__PURE__ */ import_react3.default.createElement(HubIcon, { ...props }))), "MCP Hub sidebar icon");
}
/*! Bundled license information:

smol-toml/dist/error.js:
smol-toml/dist/primitive.js:
smol-toml/dist/date.js:
smol-toml/dist/extract.js:
smol-toml/dist/util.js:
smol-toml/dist/struct.js:
smol-toml/dist/parse.js:
smol-toml/dist/stringify.js:
smol-toml/dist/index.js:
  (*!
   * Copyright (c) Squirrel Chat et al., All rights reserved.
   * SPDX-License-Identifier: BSD-3-Clause
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice, this
   *    list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   * 3. Neither the name of the copyright holder nor the names of its contributors
   *    may be used to endorse or promote products derived from this software without
   *    specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *)
*/

return module.exports;}});