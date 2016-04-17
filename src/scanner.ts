/**
 * Copyright (C) 2016 Yang Lin (MIT License)
 * @author Yang Lin <linyang95@aol.com>
 */

import * as fs from 'fs';
// import 'process';

const NIL = '';

const regExp = {
    LABEL: /[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/,
    TOKENS: /[;:,.\[\]()|^&+-/*=%!~$<>?@]/,
    NEWLINE: /(\r|\n|\r\n)/,
    TABS_AND_SPACES: /[ \t]*/,
    WHITESPACE: /[ \n\r\t]+/,
    FUNCTION: /^(function)$/i,
    CLASS: /^(class)$/i
}

enum lexerEnum {
    LABEL,
    TOKENS,
    NEWLINE,
    TABS_AND_SPACES,
    WHITESPACE
}

export enum tokenEnum {
    T_OPEN_TAG,
    T_CLOSE_TAG,
    T_FUNCTION,
    T_CLASS
}

enum stateEnum {
    IN_SCRIPTING,
    LOOKING_FOR_PROPERTY,
    BACKQUOTE,
    DOUBLE_QUOTES,
    HEREDOC,
    LOOKING_FOR_VARNAME,
    VAR_OFFSET,
    INITIAL,
    END_HEREDOC,
    NOWDOC,
}

interface lexer {
    text: string,
    type: lexerEnum,
    lineNo: number,
    col: number,
    level: number
}

interface codeSymbol {
    text: string,
    type: tokenEnum,
    lineNo: number,
    start: number,
    end: number,
    level: number
}

export class Scanner {

    text: string;
    state: stateEnum;
    stateStack: stateEnum[];
    expectTokenStack: tokenEnum[];
    lexerStack: lexer[];
    codeSymbols: codeSymbol[];
    lineNo: number;
    column: number;
    level: number;

    init() {
        this.text = NIL;
        this.stateStack = [];
        this.expectTokenStack = [];
        this.lexerStack = [];
        this.codeSymbols = [];
        this.lineNo = 1;
        this.column = 0;
        this.level = 0;

        this.setState(stateEnum.INITIAL);
    }

    debug(msg: string) {
        console.log("line " + this.lineNo + " : " + msg);
    }

    constructor(file: string, callback: (symbols: codeSymbol[]) => void) {

        this.init();

        let readable = fs.createReadStream(file, {
            encoding: 'utf8'
        });

        readable.on('data', (chunk: string) => {
            readable.pause();

            let pos = 0;
            let len = chunk.length;

            while (pos <= len) {
                this.scan(chunk[pos]);
                pos++;
            }

            readable.resume();
        });

        readable.on('end', () => {
            callback(this.codeSymbols);
            // console.log(this.lexerStack.length);
            // console.log(JSON.stringify(this.codeSymbols));
            // console.log(JSON.stringify(this.expectTokenStack));
            // console.log(this.stateStack);
            // console.log(process.memoryUsage());
        });
    }

    setState(s: stateEnum) {
        // this.debug("setState " + stateEnum[s]);
        this.state = s;
        this.stateStack.push(s);
    }

    popState() {
        this.stateStack.pop();
        this.state = this.stateStack[this.stateStack.length - 1];
        // this.debug("popState " + stateEnum[this.state]);
    }

    isState(s: stateEnum) {
        return this.state == s;
    }

    isNotState(s: stateEnum) {
        return this.state != s;
    }

    pushExpectToken(t: tokenEnum) {
        this.expectTokenStack.push(t);
    }

    pushLexerStack(type: lexerEnum) {
        // this.debug("pushLexerStack: " + this.text);
        this.lexerStack.push({
            text: this.text,
            lineNo: this.lineNo,
            type: type,
            col: this.column,
            level: this.level
        });

        let temp = this.expectTokenStack;
        let find: lexer;

        this.expectTokenStack.forEach((v, i) => {
            switch (v) {
                case tokenEnum.T_CLASS:
                case tokenEnum.T_FUNCTION:
                    find = this.lexerStack[this.lexerStack.length - 1];
                    this.pushCodeSymbols(find, v);
                    temp = temp.slice(i + 1, 1);
                    break;
                default:
                    break;
            }
        });
        this.expectTokenStack = temp;

        switch (this.text.toLowerCase()) {
            case 'function':
                if (this.isState(stateEnum.IN_SCRIPTING)) this.pushExpectToken(tokenEnum.T_FUNCTION);
                break;
            case 'class':
                if (this.isState(stateEnum.IN_SCRIPTING)) this.pushExpectToken(tokenEnum.T_CLASS);
                break;
        }
    }

    pushCodeSymbols(l: lexer, type: tokenEnum) {
        this.codeSymbols.push({
            text: l.text,
            lineNo: l.lineNo,
            start: Math.max(0, l.col - l.text.length),
            end: l.col,
            type: type,
            level: l.level
        });
    }

    scan(bit: string) {
        this.column++;

        let tmpExpectTokenStack = this.expectTokenStack;
        tmpExpectTokenStack.forEach((v, i) => {
            let action: boolean = false;
            switch (v) {
                case tokenEnum.T_OPEN_TAG:
                    if (this.text == '<?') {
                        this.setState(stateEnum.IN_SCRIPTING);
                    }
                    if (this.text.length >= 2) {
                        action = true;
                    }
                    break;
                case tokenEnum.T_CLOSE_TAG:
                    if (this.text == '?>') {
                        this.setState(stateEnum.INITIAL);
                    }
                    if (this.text.length >= 2) {
                        action = true;
                    }
                    break;
                default:
                    break;
            }
            if (action) {
                this.expectTokenStack = tmpExpectTokenStack.splice(i + 1, 1);
            }
        });

        if (regExp.TOKENS.test(bit)) {
            switch (bit) {
                case '<':
                    if (this.isState(stateEnum.INITIAL)) this.pushExpectToken(tokenEnum.T_OPEN_TAG);
                    break;
                case '?':
                    if (this.isState(stateEnum.IN_SCRIPTING)) this.pushExpectToken(tokenEnum.T_CLOSE_TAG);
                    break;
                case '{':
                case '}':
                case '(':
                    if (this.isState(stateEnum.IN_SCRIPTING)) {
                        if (regExp.LABEL.test(this.text)) {
                            this.pushLexerStack(lexerEnum.LABEL);
                        } else {
                            let token = this.expectTokenStack[this.expectTokenStack.length - 1];
                            if (token == tokenEnum.T_FUNCTION) {
                                this.expectTokenStack.pop();
                            }
                        }
                        bit = '';
                        this.text = NIL;
                    }
                    break;
                default:
                    break;
            }
        }

        if (regExp.WHITESPACE.test(bit)) {
            if (regExp.LABEL.test(this.text)) {
                this.pushLexerStack(lexerEnum.LABEL);
                this.text = NIL;
            }
        } else {
            this.text += bit;
        }

        if (regExp.NEWLINE.test(bit)) {
            this.lineNo++;
            this.column = 0;
            this.text = NIL;
        }
    }

}