/*
Visual Studio Code Plugin - PHP SYMBOLS

https://github.com/ly95/vsc.php-symbols

Copyright © 2016 LinYang <linyang95#aol.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var yy_state = "";
var yy_cursor = "";
var yy_marker = 0;
var yy_cursor_pos = 0;
var yy_cursor_line = 1;
var yy_cursor_line_marker = 0;
var token_list = [];

var loop_compare_char = function (obj) {
    var tmp = obj.split("");
    for (var i = 0; i < tmp.length; i++) {
        if (YYCH(yy_cursor_pos) != obj[i]) {
            if (i > 0) {
                yy_cursor_pos = yy_marker;
            }
            return false;
        }
        yy_cursor_pos++;
    }
    return true;
};
var loop_in_range_char = function (regexp) {
    var yych = "";
    var cnt = 0;
    while (true) {
        yych = yy_cursor[yy_cursor_pos];
        if (typeof yych == 'undefined') {
            break;
        }
        if (!regexp.test(yych)) {
            break;
        }
        yy_cursor_pos++;
        cnt++;
    }
    return cnt > 0;
};

var YYCH = function(i) {
    var yych = yy_cursor[i];
    if (typeof yych == 'string') {
        yych = yych.toLowerCase();
    }
    return yych;
}
var STATE = function (state) {
    return "yyc" + state;
};
var YYSETCONDITION = function (state) {
    yy_state = state;
};
var YYGETCONDITION = function () {
    return yy_state;
};
var BEGIN = function (state) {
    YYSETCONDITION(STATE(state))
};
var RETURN_TOKEN = function (token) {
    token_list.push({
        'token': token,
        'line': yy_cursor_line,
        'context': yy_cursor.substring(yy_marker, yy_cursor_pos),
        'start': yy_marker - yy_cursor_line_marker,
        'end': yy_cursor_pos - yy_cursor_line_marker
    });
    yy_marker = yy_cursor_pos;
    return token;
}

function initGValue() {
    yy_state = "";
    yy_cursor = "";
    yy_marker = 1;
    yy_cursor_pos = 0;
    yy_cursor_line = 1;
    yy_cursor_line_marker = 0;
    token_list = [];
}

function check_condition() {
    var yych = YYCH(yy_cursor_pos);

    // check new line.
    if(/\n/.test(yych)) {
        yy_cursor_line++;
        yy_marker = yy_cursor_pos;
        yy_cursor_line_marker = yy_cursor_pos;
        if (YYGETCONDITION() == STATE('ST_OPEN_LINE_COMMENT')) {
            BEGIN("ST_IN_SCRIPTING");
            RETURN_TOKEN("T_COMMENT_END");
        }
        yy_cursor_pos++;
        return RETURN_TOKEN("T_LINE_END");
    }

    switch (YYGETCONDITION()) {
        case "yycINITIAL":
            switch (yych) {
                case '<':
                    yy_marker = yy_cursor_pos;
                    if (loop_compare_char("<?php")) {
                        BEGIN("ST_IN_SCRIPTING");
                        return RETURN_TOKEN("T_BEGIN");
                    }
                    break;
            }
            break;
        case "yycST_OPEN_COMMENT":
            if (yych == "*") {
                yy_marker = yy_cursor_pos;
                if (loop_compare_char("*/")) {
                    BEGIN("ST_IN_SCRIPTING");
                    return RETURN_TOKEN("T_COMMENT_END");
                }
            }
            break;
        case "yycST_IN_BRACKET":
            if (yych == ")") {
                yy_marker = yy_cursor_pos;
                yy_cursor_pos++;
                BEGIN("ST_IN_SCRIPTING");
                return RETURN_TOKEN("T_TAG_BRACKET_END");
            }
            break;
        case "yycST_IN_QUOTE":
            if (yych == "'") {
                yy_marker = yy_cursor_pos;
                yy_cursor_pos++;
                BEGIN("ST_IN_SCRIPTING");
                return RETURN_TOKEN("T_TAG_QUOTE_END");
            }
            break;
        case "yycST_IN_DQUOTE":
            if (yych == '"') {
                yy_marker = yy_cursor_pos;
                yy_cursor_pos++;
                BEGIN("ST_IN_SCRIPTING");
                return RETURN_TOKEN("T_TAG_DQUOTE_END");
            }
            break;
        case "yycST_IN_SCRIPTING":
            if (/\t/.test(yych)) {
                yych = " ";
            }

            switch (yych) {
                case "{":
                    yy_marker = yy_cursor_pos;
                    yy_cursor_pos++;
                    return RETURN_TOKEN("T_TAG_BRACKET");
                case '"':
                    yy_marker = yy_cursor_pos;
                    yy_cursor_pos++;
                    BEGIN("ST_IN_DQUOTE");
                    return RETURN_TOKEN("T_TAG_DQUOTE");
                case "'":
                    yy_marker = yy_cursor_pos;
                    yy_cursor_pos++;
                    BEGIN("ST_IN_QUOTE");
                    return RETURN_TOKEN("T_TAG_QUOTE");
                case "(":
                    yy_marker = yy_cursor_pos;
                    yy_cursor_pos++;
                    BEGIN("ST_IN_BRACKET");
                    return RETURN_TOKEN("T_TAG_BRACKET");
                case ")":
                    yy_marker = yy_cursor_pos;
                    yy_cursor_pos++;
                    return RETURN_TOKEN("T_TAG_BRACKET_END");
                case "}":
                    yy_marker = yy_cursor_pos;
                    yy_cursor_pos++;
                    return RETURN_TOKEN("T_TAG_BRACKET_END");
                case "#":
                    yy_marker = yy_cursor_pos;
                    BEGIN("ST_OPEN_LINE_COMMENT");
                    return RETURN_TOKEN("T_COMMENT");
                case "/":
                    yy_marker = yy_cursor_pos;
                    if (loop_compare_char("//")) {
                        BEGIN("ST_OPEN_LINE_COMMENT");
                        return RETURN_TOKEN("T_COMMENT");
                    }
                    if (loop_compare_char("/*")) {
                        BEGIN("ST_OPEN_COMMENT");
                        return RETURN_TOKEN("T_COMMENT");
                    }
                    break;
                case "c":
                    yy_marker = yy_cursor_pos;
                    if (loop_compare_char("class ")) {
                        yy_cursor_pos--;
                        return RETURN_TOKEN("T_CLASS");
                    }
                    break;
                case "f":
                    yy_marker = yy_cursor_pos;
                    if (loop_compare_char("function ")) {
                        yy_cursor_pos--;
                        return RETURN_TOKEN("T_FUNCTION");
                    }
                    break;
                case "t":
                    yy_marker = yy_cursor_pos;
                    if (loop_compare_char("trait ")) {
                        yy_cursor_pos--;
                        return RETURN_TOKEN("T_CLASS");
                    }
                    break;
                case "e":
                    yy_marker = yy_cursor_pos;
                    if (loop_compare_char("echo")) {
                        return RETURN_TOKEN("T_ECHO");
                    }
                    if (loop_compare_char("extends")) {
                        return RETURN_TOKEN("T_EXTENDS");
                    }
                    break;
                case "i":
                    yy_marker = yy_cursor_pos;
                    if (loop_compare_char("implements")) {
                        return RETURN_TOKEN("T_IMPLEMENTS");
                    }
                    if (loop_compare_char("interface ")) {
                        yy_cursor_pos--;
                        return RETURN_TOKEN("T_INTRTFACE");
                    }
                    break;
                case "?":
                    var point = yy_cursor_pos;
                    if (loop_compare_char("?>")) {
                        yy_marker = point;
                        BEGIN("INITIAL");
                        return RETURN_TOKEN("T_END");
                    }
                    break;
                case " ":
                    yy_marker = yy_cursor_pos;
                    loop_in_range_char(/[ \t]/);
                    return RETURN_TOKEN("T_WHITESPACE");
            }
            // label
            if (loop_in_range_char(/[a-zA-Z0-9_]/)) {
                // [a-zA-Z0-9_\x7f-\xff]
                return RETURN_TOKEN("T_LABEL");
            }
            break;
    }
    return false;
}


function scan() {
    var cond_result = check_condition();
    if (cond_result) {
        return cond_result;
    }

    yy_cursor_pos++;

    if (yy_cursor_pos >= yy_cursor.length) {
        return "T_END";
    }

    return true;
}

function analyst(code) {
    var symbols = [];
    var token = '';

    initGValue();

    BEGIN("INITIAL");
    yy_cursor = code

    while (token = scan()) {
        if (token == "T_INPUT_ERROR") {
            break;
        }
        if (token == "T_END") {
            break;
        }
    }

    if (token_list) {
        var i = 0;
        while (i < token_list.length) {
            var item = {
                'text': '',
                'type': '',
                'range': [-1,-1,-1,-1]
            };
            if (token_list[i]['token'] == 'T_FUNCTION' || token_list[i]['token'] == 'T_CLASS' || token_list[i]['token'] == 'T_INTRTFACE') {
                item.type = token_list[i]['token'];
                i++;
                while(i < token_list.length) {
                    if (token_list[i]['token'] == 'T_WHITESPACE' || token_list[i]['token'] == 'T_LINE_END') {
                        i++;
                        continue;
                    }
                    if (token_list[i]['token'] != 'T_LABEL') {
                        i--;
                        break;
                    }
                    if (item.range[0] == -1) {
                        item.range[0] = Math.max(0, token_list[i]['line']-1);
                        item.range[1] = Math.max(0, token_list[i]['start']-1);
                        item.range[2] = Math.max(0, token_list[i]['line']-1);
                        item.range[3] = token_list[i]['end'];
                    } else {
                        item.range[2] = Math.max(0, token_list[i]['line']-1);
                        item.range[3] = token_list[i]['end'];
                    }
                    item.text += token_list[i]['context'].trim();
                    i++;
                }
                if (item.range[0] > 0 && item.range[1] > 0 && item.range[2] > 0 && item.range[3] > 0) {
                    symbols.push(item);
                }
            }
            i++;
        }
    }
    return symbols;
}

let vscode = require('vscode');
let fs = require('fs');

var PHPDocumentSymbolProvider = (function () {
    function PHPDocumentSymbolProvider() {
    }
    PHPDocumentSymbolProvider.prototype.provideDocumentSymbols = function (document, token) {
        return new Promise(function (resolve) {
            fs.readFile(document.fileName, 'utf8', function(err, content){
                if (err) {
                    throw err;
                };
                resolve(content);
            });
        }).then(function(context) {
            var result = analyst(context);
            var ret = [];
            if (result) {
                for (var i in result) {
                    if (result.hasOwnProperty(i)) {
                        var element = result[i];

                        var type = null;
                        if (element.type == 'T_CLASS') {
                            type = vscode.SymbolKind.Class;
                        } else if (element.type == 'T_FUNCTION') {
                            type = vscode.SymbolKind.Function;
                        } else if (element.type == 'T_INTRTFACE') {
                            type = vscode.SymbolKind.Interface;
                        }

                        if (type == null) {
                            continue;
                        }

                        var range = new vscode.Range(
                            new vscode.Position(element.range[0], element.range[1]),
                            new vscode.Position(element.range[2], element.range[3])
                        );

                        ret.push(
                            new vscode.SymbolInformation(element.text, type, range)
                        );
                    }
                }
            }

            return ret;
        }).catch(function(err) {
            console.error(err);
        });
    };
    return PHPDocumentSymbolProvider;
}());

function activate(context) {
    var selector = {
        language: 'php',
        scheme: 'file'
    };
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, new PHPDocumentSymbolProvider));
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
