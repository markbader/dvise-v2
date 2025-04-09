import axios from 'axios';
import * as vscode from 'vscode';
// import { getAllFilesInWorkspace } from '../chat/chatContext';

const API_URL = 'https://api.openai.com/v1/chat/completions';
const chatHistory: { role: 'user' | 'assistant' | 'system'; content: string }[] = [{ role: 'system', content: `You are a mentor while the user is a junior software engineer. The user is trying to understand a software project. You get all files related to this project in this chat and the source code the user refers to together with his message. You answer each question, fitting to the content and tailored to a junior software engineer. You are capable of rendering mermaid diagrams. Whenever it might help generate mermaid source code within a \`\`\`mermaid ... \`\`\` environment. Let's start!\n\n` }];
// await (async () => {
//     const chatHistory = 
//     const context = await getAllFilesInWorkspace();
//     for (const item of context) {
//         const { role, content } = item;
//         chatHistory.push({ role: role, content: content });
//     }
// })();

export async function* getChatStream(query: string, withHistory: boolean = true): AsyncGenerator<string> {
    const API_KEY = await vscode.commands.executeCommand('dvise.getApiKey');

    // Add user message to history
    if (withHistory) {
        chatHistory.push({ role: 'user', content: query });
    }

    const response = await axios.post(API_URL, {
        model: 'gpt-4',
        messages: withHistory ? chatHistory : [{ role: 'user', content: query }],
        stream: true
    }, {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        responseType: 'stream'
    });

    const decoder = new TextDecoder();
    let buffer = '';

    let assistantResponse = "";

    for await (const chunk of response.data) {
        buffer += decoder.decode(chunk, { stream: true }); // Append to buffer

        const lines = buffer.split("\n"); // OpenAI sends multiple JSON objects
        buffer = lines.pop() || ''; // Keep incomplete part for next iteration

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                const jsonPart = line.substring(5).trim(); // Remove "data: "

                if (jsonPart === "[DONE]") {
                    return; // Stop streaming when OpenAI signals completion
                }

                try {
                    const jsonData = JSON.parse(jsonPart);
                    if (jsonData.choices && jsonData.choices[0].delta.content) {
                        const content = jsonData.choices[0].delta.content || "";
                        assistantResponse += content;
                        yield content;
                    }
                } catch (error) {
                    console.error('Error parsing JSON:', error, line);
                }
            }
        }
    }
    // Add the assistant's response to the chat history
    chatHistory.push({ role: 'assistant', content: assistantResponse });

    // Trim history to prevent exceeding token limits
    if (chatHistory.length > 20) {
        chatHistory.splice(0, chatHistory.length - 20);
    }

}