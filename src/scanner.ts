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
    NEWLINE: /("\r"|"\n"|"\r\n")/,
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
    level: number
}

interface codeSymbol {
    text: string,
    type: tokenEnum,
    lineNo: number,
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
    level: number;

    init() {
        this.text = NIL;
        this.stateStack = [];
        this.expectTokenStack = [];
        this.lexerStack = [];
        this.codeSymbols = [];
        this.lineNo = 1;
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
            // console.log(this.codeSymbols);
            // console.log(this.expectTokenStack);
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
        this.lexerStack.push({
            text: this.text,
            lineNo: this.lineNo,
            type: type,
            level: this.level
        });
    }

    pushCodeSymbols(l: lexer, type: tokenEnum) {
        this.codeSymbols.push({
            text: l.text,
            lineNo: l.lineNo,
            type: type,
            level: l.level
        });
    }

    scan(bit: string) {
        if (/\r/.test(bit)) return;

        if (/\n/.test(bit)) {
            // this.debug(this.text);
            this.lineNo++;
            this.text = NIL;
            return;
        }

        // --- lexer

        if (this.isState(stateEnum.IN_SCRIPTING)) {
            if (bit == ' ' || /\t/.test(bit)) {

                if (regExp.FUNCTION.test(this.text)) this.pushExpectToken(tokenEnum.T_FUNCTION);
                if (regExp.CLASS.test(this.text)) this.pushExpectToken(tokenEnum.T_CLASS);

                let lastExpectToken = this.expectTokenStack[this.expectTokenStack.length - 1];

                if (lastExpectToken == tokenEnum.T_FUNCTION || lastExpectToken == tokenEnum.T_CLASS) {
                    if (regExp.LABEL.test(this.text)) {
                        this.pushLexerStack(lexerEnum.LABEL);
                    }
                }

                this.text = NIL;
                return;
            }
        }

        switch (bit) {
            case '<':
                if (this.isState(stateEnum.INITIAL)) this.pushExpectToken(tokenEnum.T_OPEN_TAG);
                break;
            case '?':
                if (this.isState(stateEnum.IN_SCRIPTING)) this.pushExpectToken(tokenEnum.T_CLOSE_TAG);
                break;
            case '"':
                if (this.isState(stateEnum.DOUBLE_QUOTES)) this.popState();
                else if (this.isState(stateEnum.IN_SCRIPTING)) this.setState(stateEnum.DOUBLE_QUOTES);
                break;
            case '(':
                if (this.isNotState(stateEnum.INITIAL)) {
                    if (regExp.LABEL.test(this.text)) this.pushLexerStack(lexerEnum.LABEL);
                    this.setState(stateEnum.VAR_OFFSET);
                }
                break;
            case ')':
                if (this.isState(stateEnum.VAR_OFFSET)) {
                    this.popState();
                    // this.debug(this.text);
                    this.text = NIL; // ignore
                    return;
                }
                break
            case '{':
                this.level++;
                break;
            case '}':
                this.level--;
                break;
            default:
                break;
        }

        this.text += bit;

        if (this.isState(stateEnum.DOUBLE_QUOTES)) return;

        // --- parser

        let pos = 0;
        let len = this.expectTokenStack.length;
        let tmpExpectTokenStack = this.expectTokenStack;

        while (pos <= len) {
            let pop_expect_stack: boolean = false;
            switch (this.expectTokenStack[pos]) {
                case tokenEnum.T_OPEN_TAG:
                    if (this.text == '<?') {
                        this.setState(stateEnum.IN_SCRIPTING);
                    }
                    pop_expect_stack = this.text.length > 2;
                    break;
                case tokenEnum.T_CLOSE_TAG:
                    let find = this.text.substr(this.text.lastIndexOf('?'));
                    if (find == '?>') this.popState();
                    find = null;
                    pop_expect_stack = this.text.length > 2;
                    break;
                case tokenEnum.T_CLASS:
                    if (bit == '{') {
                        let find = this.lexerBackwardLookup(regExp.CLASS);
                        if (find.length >= 1) {
                            let item = find.pop();
                            this.pushCodeSymbols(item, tokenEnum.T_CLASS);
                        }
                        pop_expect_stack = true;
                    }
                    break;
                case tokenEnum.T_FUNCTION:
                    if (bit == '(') {
                        let find = this.lexerBackwardLookup(regExp.FUNCTION);
                        if (find.length >= 2) {
                            let item = find[find.length - 2];
                            this.pushCodeSymbols(item, tokenEnum.T_FUNCTION);
                        }
                        pop_expect_stack = true;
                    }
                    break;
                default:
                    break;
            }
            if (pop_expect_stack) {
                tmpExpectTokenStack = tmpExpectTokenStack.splice(pos + 1, 1);
            }
            pos++;
        } // while

        this.expectTokenStack = tmpExpectTokenStack;
    }

    lexerBackwardLookup(regexp: RegExp): lexer[] {
        let len = this.lexerStack.length - 1;
        let pos = len;
        let ret = [];
        while (pos > 0) {
            let item = this.lexerStack[pos];
            ret.push(item);
            if (regexp.test(item.text)) {
                break;
            }
            pos--;
        }
        return ret;
    }

}