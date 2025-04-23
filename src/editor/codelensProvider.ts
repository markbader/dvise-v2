import * as vscode from 'vscode';
import Parser from 'tree-sitter';

const LANG_MAP: Record<string, any> = {
    'javascript': require('tree-sitter-javascript'),
    'python': require('tree-sitter-python'),
    'java': require('tree-sitter-java'),
    // Add more
};

export class VisualizeCodeLensProvider implements vscode.CodeLensProvider {
    private parser: Parser;
    constructor() {
        this.parser = new Parser();
    }
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const lenses: vscode.CodeLens[] = [];
        const tsLang = LANG_MAP[document.languageId];
        if (!tsLang) return []; // skip unsupported
        this.parser.setLanguage(tsLang);
        const tree = this.parser.parse(document.getText());
        if (!tree) return []; // skip if tree is not generated

        const visitNode = (node: any) => {
            if (node.type === 'function_definition' || node.type === 'function_declaration' || node.type === 'class_definition' || node.type === 'class_declaration') {
                const startPosition = new vscode.Position(node.startPosition.row, node.startPosition.column);
                const endPosition = new vscode.Position(node.endPosition.row, node.endPosition.column);
                const range = new vscode.Range(startPosition, endPosition);
                const selectedText = document.getText(range);

                lenses.push(new vscode.CodeLens(range, {
                    title: "👁 Visualize",
                    command: "dvise.visualizeCode",
                    arguments: [{ text: selectedText, document, startLine: node.startPosition.row }]
                }));
            }

            for (let i = 0; i < node.namedChildCount; i++) {
                visitNode(node.namedChild(i));
            }
        };

        visitNode(tree.rootNode);

        return lenses;
    }
}
