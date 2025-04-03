import axios from 'axios';
import * as vscode from 'vscode';

const API_URL = 'https://api.openai.com/v1/chat/completions';

const chatHistory: { role: 'user' | 'assistant'; content: string }[] = [];

export async function* getChatStream(query: string) {
    const API_KEY = await vscode.commands.executeCommand('dvise.getApiKey');

    // Add user message to history
    chatHistory.push({ role: 'user', content: query });

    const response = await axios.post(API_URL, {
        model: 'gpt-4',
        messages: chatHistory,
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