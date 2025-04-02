import * as vscode from 'vscode';

export class HoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) return;

        const word = document.getText(wordRange);
        const button = new vscode.MarkdownString(`[Visualize ${word}](command:dvise.visualizeCode)`);
        button.isTrusted = true;

        return new vscode.Hover(button);
    }
}