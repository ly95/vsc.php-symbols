/**
 * Copyright (C) 2016 Yang Lin (MIT License)
 * @author Yang Lin <linyang95@aol.com>
 */

'use strict';
import * as vscode from 'vscode';
import {Scanner, tokenEnum} from './scanner';

class PHPDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        return new Promise(function(resolve) {
            let uri = vscode.Uri.parse(document.uri.toString());
            new Scanner(uri.path, (sombols) => {
                let data: vscode.SymbolInformation[] = [];
                for (let index = 0; index < sombols.length; index++) {
                    let item = sombols[index];

                    let type: vscode.SymbolKind;
                    switch (item.type) {
                        case tokenEnum.T_CLASS:
                            type = vscode.SymbolKind.Class;
                            break;
                        case tokenEnum.T_FUNCTION:
                            type = vscode.SymbolKind.Function;
                            break;
                        default:
                            continue;
                    }
                    let range = new vscode.Range(new vscode.Position(item.lineNo - 1, 0), new vscode.Position(item.lineNo - 1, Number.MAX_VALUE));
                    data.push(new vscode.SymbolInformation(item.text, type, range, undefined));
                }
                resolve(data);
            });
        }).then(function(value) {
            return value;
        });
    }
}

export function activate(context: vscode.ExtensionContext) {
    let selector: vscode.DocumentFilter = {
        language: 'php',
        scheme: 'file'
    };
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(selector, new PHPDocumentSymbolProvider)
    );
}

export function deactivate() {
}