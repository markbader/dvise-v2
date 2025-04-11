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
    let assistantResponse = "";
    for await (const response of getResponse(withHistory ? chatHistory : [{ role: 'user', content: query }], true)) {
        assistantResponse += response;
        yield response;
    }
    if (withHistory) {
        // Add the assistant's response to the chat history
        chatHistory.push({ role: 'assistant', content: assistantResponse });

        // Trim history to prevent exceeding token limits
        if (chatHistory.length > 20) {
            chatHistory.splice(0, chatHistory.length - 20);
        }
    }

}
async function* getResponse(history: { role: 'user' | 'assistant' | 'system'; content: string }[], stream: boolean = true): AsyncGenerator<string> {
    const API_KEY = await vscode.commands.executeCommand('dvise.getApiKey');

    const response = await axios.post(API_URL, {
        model: 'gpt-4',
        messages: history,
        stream: stream
    }, {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        responseType: stream ? 'stream' : 'json'
    });
    if (stream) {
        const decoder = new TextDecoder();
        let buffer = '';

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
                            yield content;
                        }
                    } catch (error) {
                        console.error('Error parsing JSON:', error, line);
                    }
                }
            }
        }
    } else {
        const jsonData = response.data;
        if (jsonData.choices && jsonData.choices[0].message.content) {
            const content = jsonData.choices[0].message.content || "";
            yield content;
        }
    }
}

export async function getDiagramCodeMapping(context: any): Promise<Map<string, { document: vscode.TextDocument, lineRane: vscode.Range, text: string }>> {
    const sourceCode = context.text;
    const contextStartLine = context.startLine;
    const file = context.file;
    const diagram = context.diagram;
    const nodeNames = context.nodeNames;
    let tempHistory: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];

    // This follows the chain of thoughts pattern to get a mapping of nodes to source code
    // First I ask the assistant to annotate the source code with line numbers
    tempHistory.push({ role: 'user', content: `Please add zero-indexed line numbers to this piece of source code:\n${sourceCode}` });

    let assistantContent = '';
    for await (const chunk of getResponse(tempHistory, false)) {
        assistantContent += chunk;
    }
    tempHistory.push({ role: 'assistant', content: assistantContent });

    // Then I give it the diagram nodes and ask it to map the nodes to line ranges
    const nodesList = nodeNames.map((node: string) => `\n${node}`).join('');
    tempHistory.push({ role: 'user', content: `This is a mermaid diagram explaining the code:\n\`\`\`mermaid\n${diagram}\n\`\`\`. It contains these nodes: ${nodesList}\n\nGive me a json dict in a \`\`\`json environment, that contains every node name as key, and a dict {startLine: number, endLine: number, description: string} as value. The startLine should be the first line of code the node refers to, the endLine is the last line and description should be a two sentence summery of the nodes meaning.` });
    assistantContent = '';
    for await (const chunk of getResponse(tempHistory, false)) {
        assistantContent += chunk;
    }
    tempHistory.push({ role: 'assistant', content: assistantContent });

    console.log(tempHistory);

    // Parse the JSON response from the assistant
    const jsonResponse = extractJsonFromResponse(assistantContent);
    if (!jsonResponse[1]) {
        // Implement a retry loop here that requests the assistant to fix the json
        console.error("Failed to parse JSON response from assistant.");
    }
    const jsonData = jsonResponse[0];
    const updated: any = {};
    for (const key in jsonData) {
        const { startLine, endLine, description } = jsonData[key];
        const start = Number(startLine) + Number(contextStartLine);
        const end = Number(endLine) + Number(contextStartLine);
        updated[key] = { file: file, start: start, end: end, text: description };
    }
    return updated
}

function extractJsonFromResponse(response: string): [any, boolean] {
    const regex = /```json\s*([\s\S]*?)\s*```/g;
    const match = regex.exec(response);

    if (match && match[1]) {
        const jsonStr = match[1].trim();

        try {
            const parsed = JSON.parse(jsonStr);
            console.log("Parsed JSON:", parsed);
            return [parsed, true];
        } catch (error) {
            console.error("Failed to parse JSON:", error, "\nJSON string was:", jsonStr);
            return [null, false];
        }
    } else {
        console.warn("No JSON block found in response.");
        return [null, false];
    }
}
