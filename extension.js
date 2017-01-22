let vscode = require('vscode');
var engine = require('php-parser');
var fs = require('fs');
var parser = new engine({
    parser: {
        debug: false,
        locations: true,
        extractDoc: false,
        suppressErrors: true
    },
    lexer: {
        all_tokens: false,
        comment_tokens: false,
        mode_eval: false,
        asp_tags: false,
        short_tags: true
    },
    ast: {
        withPositions: true
    }
});
var PHPDocumentSymbolProvider = (function () {
    function PHPDocumentSymbolProvider() {
    }
    PHPDocumentSymbolProvider.prototype.provideDocumentSymbols = function (document, token) {
        return new Promise(function (resolve) {
            fs.readFile(document.fileName, 'utf8', function (err, content) {
                if (err) {
                    throw err;
                };
                resolve(content);
            });
        }).then(function (context) {
            var ret = [];
            var newRangeFromAST = function (item) {
                return new vscode.Range(
                    new vscode.Position(item.loc.start.line - 1, item.loc.start.column),
                    new vscode.Position(item.loc.end.line - 1, item.loc.end.column)
                );
            };
            var findAST = function (obj) {
                for (var i in obj) {
                    var item = obj[i];
                    var type = null;
                    switch (item.kind) {
                        case 'class':
                            type = vscode.SymbolKind.Class;
                            findAST(item.body);
                            break;
                        case 'method':
                        case 'function':
                            type = vscode.SymbolKind.Function;
                            break;
                        default:
                            break;
                    }
                    if (type != null) {
                        ret.push(
                            new vscode.SymbolInformation(item.name, type, newRangeFromAST(item))
                        );
                    }
                    if (item.children) {
                        findAST(item.children);
                    }
                }
            };

            var AST = parser.parseCode(context);
            console.log(JSON.stringify(AST.children));
            if (AST.children) {
                findAST(AST.children);
            }
            return ret;
        }).catch(function (err) {
            console.error(err);
        });
    };
    return PHPDocumentSymbolProvider;
} ());

function activate(context) {
    var selector = {
        language: 'php',
        scheme: 'file'
    };
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, new PHPDocumentSymbolProvider));
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
