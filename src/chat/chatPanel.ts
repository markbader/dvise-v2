import * as vscode from 'vscode';
import { getChatStream } from './chatService';

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
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ChatGPT Assistant</title>
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <script>
                const vscode = acquireVsCodeApi();

                function sendMessage() {
                    const inputField = document.getElementById('userInput');
                    const text = inputField.value.trim();
                    if (!text) return;

                    vscode.postMessage({ command: 'sendMessage', text });
                    inputField.value = '';

                    // addMessage('user', text);
                }

                function addMessage(sender, text) {
                    const chatContainer = document.getElementById('chat');
                    const messageBubble = document.createElement('div');
                    messageBubble.classList.add('message', sender);
                    messageBubble.innerHTML = sender === 'user' ? text : marked.parse(text);
                    chatContainer.appendChild(messageBubble);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
                
                function updateOrAddAssistantMessage(text) {
                    const chatContainer = document.getElementById('chat');
                    let lastMessage = chatContainer.querySelector('.message.assistant:not(.finished)');

                    if (!lastMessage) {
                        // No unfinished message exists, create a new one
                        lastMessage = document.createElement('div');
                        lastMessage.classList.add('message', 'assistant');
                        lastMessage.dataset.fullText = text; // Store full text in a dataset attribute
                        lastMessage.innerHTML = marked.parse(text);
                        chatContainer.appendChild(lastMessage);
                    } else {
                        // Append new text chunk and re-render markdown
                        lastMessage.dataset.fullText += text;
                        lastMessage.innerHTML = marked.parse(lastMessage.dataset.fullText);
                    }

                    chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to latest message
                }

                function markLastAssistantMessageAsFinished() {
                    const chatContainer = document.getElementById('chat');
                    let lastMessage = chatContainer.querySelector('.message.assistant:not(.finished)');

                    if (lastMessage) {
                        lastMessage.classList.add('finished');
                    }
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'userMessage') {
                        addMessage('user', message.text);
                    } else if (message.command === 'addResponseChunk') {
                        updateOrAddAssistantMessage(message.text);
                    } else if (message.command === 'finishResponse') {
                        markLastAssistantMessageAsFinished();
                    }
                });

                document.addEventListener('DOMContentLoaded', () => {
                    document.getElementById('sendBtn').addEventListener('click', sendMessage);
                    document.getElementById('userInput').addEventListener('keypress', (event) => {
                        if (event.key === 'Enter') sendMessage();
                    });
                });
            </script>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 0;
                    margin: 0;
                    background-color: var(--vscode-editor-background); /* VS Code background */
                    color: var(--vscode-editor-foreground); /* VS Code text color */
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    overflow: hidden;
                }

                #chatContainer {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }

                /* Chat background + Scrollbar */
                #chat {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 15px;
                    border-radius: 8px;
                    border: 1px solid var(--vscode-editorWidget-border);
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                /* Scrollbar styling */
                #chat::-webkit-scrollbar {
                    width: 8px;
                }

                #chat::-webkit-scrollbar-thumb {
                    background-color: var(--vscode-scrollbarSlider-background);
                    border-radius: 4px;
                }

                #chat::-webkit-scrollbar-track {
                    background-color: var(--vscode-editor-background);
                }

                /* Messages */
                .message {
                    padding: 10px 15px;
                    border-radius: 15px;
                    max-width: 70%;
                    word-wrap: break-word;
                    display: inline-block;
                }

                /* User message (right, uses theme accent color) */
                .user {
                    background-color: var(--vscode-editor-foreground);
                    color: var(--vscode-editor-background);
                    align-self: flex-end;
                    text-align: right;
                }

                /* Assistant message (left, softer background) */
                .assistant {
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    align-self: flex-start;
                }

                /* Input field container */
                #inputContainer {
                    display: flex;
                    align-items: center;
                    padding: 10px;
                    background: var(--vscode-editor-background);
                    border-top: 1px solid var(--vscode-editorWidget-border);
                    position: relative;
                }

                /* Input field (ChatGPT-style) */
                #userInput {
                    flex-grow: 1;
                    padding: 12px;
                    border: none;
                    border-radius: 20px;
                    outline: none;
                    font-size: 14px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                }

                /* Send button (VS Code primary button color) */
                #sendBtn {
                    padding: 10px 15px;
                    margin-left: 8px;
                    cursor: pointer;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 20px;
                    font-weight: bold;
                }

                #sendBtn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div id="chat"></div>
            <div id="inputContainer">
                <input type="text" id="userInput" placeholder="Ask ChatGPT..." />
                <button id="sendBtn">Send</button>
            </div>
        </body>
        </html>
    `;
    }
}
