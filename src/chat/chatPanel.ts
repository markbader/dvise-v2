import * as vscode from 'vscode';
import { getChatStream } from './chatService';
import * as path from 'path';
import * as fs from 'fs';

export class ChatPanel {
    public static readonly viewType = 'dvise.chatView';
    private static panel: vscode.WebviewPanel | undefined;
    private readonly context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {
        this.context = context;
        ChatPanel.panel = panel;

        const webview = panel.webview;
        webview.options = { enableScripts: true };
        webview.html = this.getHtml();

        webview.onDidReceiveMessage(this.handleMessage.bind(this));

        panel.onDidDispose(() => {
            ChatPanel.panel = undefined;
        });
    }

    public static createOrShow(context: vscode.ExtensionContext) {
        if (ChatPanel.panel) {
            ChatPanel.panel.reveal(vscode.ViewColumn.Beside);
        } else {
            const panel = vscode.window.createWebviewPanel(
                ChatPanel.viewType,
                'Chat Assistant',
                vscode.ViewColumn.Beside, // Opens in a new tab
                { enableScripts: true }
            );
            new ChatPanel(context, panel);
        }
    }

    private async handleMessage(message: any) {
        if (!ChatPanel.panel) return;
        const webview = ChatPanel.panel.webview;

        if (message.command === 'sendMessage') {
            const userMessage = message.text;
            webview.postMessage({ command: 'userMessage', text: userMessage });

            // Stream response from ChatGPT
            const chatStream = await getChatStream(userMessage);
            for await (const chunk of chatStream) {
                webview.postMessage({ command: 'addResponseChunk', text: chunk });
            }

            webview.postMessage({ command: 'finishResponse' });

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
