import * as vscode from 'vscode';

export class HoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
        const editor = vscode.window.activeTextEditor;

        const selection = editor?.selection || new vscode.Selection(position, position);
        const startLine = Math.min(selection.start.line, selection.end.line);
        const endLine = Math.max(selection.start.line, selection.end.line);
        const fullRange = new vscode.Range(
            new vscode.Position(startLine, 0),
            document.lineAt(endLine).range.end
        );
        const selectedText = document.getText(fullRange);

        const isSelection = !selection.isEmpty && selection.contains(position);

        if (isSelection) {
            const markdown = new vscode.MarkdownString(
                `[✨ Visualize](command:dvise.visualizeCode?${encodeURIComponent(JSON.stringify({ text: selectedText, document: document }))})`
            );
            markdown.isTrusted = true;
            return new vscode.Hover(markdown);
        }

        return undefined;
    }
}