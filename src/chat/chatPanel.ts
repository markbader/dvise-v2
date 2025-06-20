import * as vscode from 'vscode';
import { getChatStream, getDiagramCodeMapping } from './chatService';
import * as path from 'path';
import * as fs from 'fs';

export class ChatPanel {
    public static readonly viewType = 'dvise.chatView';
    private static panel: vscode.WebviewPanel | undefined;
    private readonly context: vscode.ExtensionContext;
    private static messageIdCounter: number = 0;

    private constructor(context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {
        this.context = context;
        ChatPanel.panel = panel;

        const webview = panel.webview;
        webview.options = { enableScripts: true };
        webview.html = this.getHtml();

        webview.onDidReceiveMessage(ChatPanel.handleMessage.bind(this));

        panel.onDidDispose(() => {
            ChatPanel.panel = undefined;
        });
    }

    public static createOrShow(context: vscode.ExtensionContext) {
        if (ChatPanel.panel) {
            ChatPanel.panel.reveal();
        } else {
            const panel = vscode.window.createWebviewPanel(
                ChatPanel.viewType,
                'Chat Assistant',
                vscode.ViewColumn.Beside, // Opens in a new tab
                { enableScripts: true, retainContextWhenHidden: true }
            );
            new ChatPanel(context, panel);
        }
    }

    public static async handleMessage(message: any) {
        const currentMessageId = ChatPanel.messageIdCounter++;
        if (!ChatPanel.panel) return;
        const webview = ChatPanel.panel.webview;
        console.log(`${message.command} message received:`, message);

        if (message.command === 'dvise.sendMessage') {
            // Send the message to the webview
            const userMessage = message.text;
            webview.postMessage({ command: 'dvise.userMessage', text: userMessage });

            // Stream response from ChatGPT
            const chatStream = getChatStream(userMessage);
            for await (const chunk of chatStream) {
                webview.postMessage({ command: 'dvise.addResponseChunk', text: chunk, messageId: currentMessageId });
            }

            webview.postMessage({ command: 'dvise.finishResponse', messageId: currentMessageId, context: message.context });
        } else if (message.command === 'dvise.cleanupMermaidCode') {
            const { messageId, prompt } = message;
            let response = ""
            const chatStream = getChatStream(prompt, false);
            for await (const chunk of chatStream) {
                response += chunk;
            }
            webview.postMessage({ command: 'dvise.cleanupResponse', messageId: messageId, response: response });
        } else if (message.command === 'dvise.getNodeDescriptions') {
            const response = await getDiagramCodeMapping(message.context);
            webview.postMessage({
                command: 'dvise.setNodeDescriptions', messageId: message.messageId, mapping: response
            })
        } else if (message.command === "dvise.highlightLine") {
            highlightLine(message.file, message.start, message.end);
        }
    }


    private getHtml(): string {
        // Get path to index.html
        const indexPath = path.join(this.context.extensionPath, 'src', 'chat', 'index.html');

        // Read index.html content
        try {
            return fs.readFileSync(indexPath, 'utf8');
        } catch (error) {
            console.error('Error reading index.html:', error);
            return `<html><body><h1>Error loading chat panel</h1></body></html>`;
        }
    }
}

async function highlightLine(filePath: string, start: number, end: number) {
    let document = await vscode.workspace.openTextDocument(vscode.Uri.parse(filePath));
    let editor = vscode.window.visibleTextEditors.find(ed => ed.document.uri.fsPath === filePath);

    // If the file is not already open, open it in an editor
    if (!editor) {
        editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    } else {
        await vscode.window.showTextDocument(editor.document, vscode.ViewColumn.One);
    }

    if (!editor) {
        vscode.window.showErrorMessage("Unable to open the file.");
        return;
    }

    const range = new vscode.Range(
        start,
        0,
        end,
        editor.document.lineAt(end).text.length
    );


    // Create a decoration type with a background color
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 165, 0, 0.3)", // Light orange highlight
        isWholeLine: true // Highlights the full line
    });

    // Apply the decoration
    editor.setDecorations(decorationType, [range]);

    // Scroll to the line and center it in the editor
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

    setTimeout(() => {
        editor?.setDecorations(decorationType, []); // Clear decoration
    }, 3000);
}