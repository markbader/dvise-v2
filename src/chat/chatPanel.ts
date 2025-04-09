import * as vscode from 'vscode';
import { getChatStream } from './chatService';
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
                { enableScripts: true }
            );
            new ChatPanel(context, panel);
        }
    }

    public static async handleMessage(message: any, context: { file?: string, text?: string } = {}) {
        const currentMessageId = ChatPanel.messageIdCounter++;
        if (!ChatPanel.panel) return;
        const webview = ChatPanel.panel.webview;

        if (message.command === 'dvise.sendMessage') {
            console.log('Received message:', message);
            // Send the message to the webview
            const userMessage = message.text;
            webview.postMessage({ command: 'dvise.userMessage', text: userMessage });

            // Stream response from ChatGPT
            const chatStream = getChatStream(userMessage);
            for await (const chunk of chatStream) {
                webview.postMessage({ command: 'dvise.addResponseChunk', text: chunk, messageId: currentMessageId });
            }

            webview.postMessage({ command: 'dvise.finishResponse', messageId: currentMessageId, context: context });
        } else if (message.command === 'dvise.cleanupMermaidCode') {
            const { messageId, prompt } = message;
            console.log('Received cleanup request:', messageId, prompt);
            let response = ""
            const chatStream = getChatStream(prompt, false);
            for await (const chunk of chatStream) {
                response += chunk;
            }
            webview.postMessage({ command: 'dvise.cleanupResponse', messageId: messageId, response: response });
        }
    }

    public static async handleRefineMessage(message: string): Promise<string> {
        if (!ChatPanel.panel) return "";
        const webview = ChatPanel.panel.webview;

        let responseText = "";

        const chatStream = getChatStream(message, false);
        for await (const chunk of chatStream) {
            responseText += chunk;
        }
        return responseText;
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
