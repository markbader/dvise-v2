import * as vscode from 'vscode';
import { FileExplorerView } from './fileExplorer/fileExplorerView';
import { ChatPanel } from './chat/chatPanel';
import { HoverProvider } from './editor/hoverProvider';
import { VisualizeCodeLensProvider } from './editor/codelensProvider';

export async function activate(context: vscode.ExtensionContext) {

	const storedApiKey = await context.secrets.get('openaiApiKey');

	context.subscriptions.push(vscode.commands.registerCommand('dvise.setApiKey', async () => {
		const newApiKey = await vscode.window.showInputBox({
			prompt: 'Enter a new OpenAI API Key',
			placeHolder: 'sk-xxxxxxxxxxxxxxxx',
			ignoreFocusOut: true,
			password: true
		});

		if (newApiKey) {
			await context.secrets.store('openaiApiKey', newApiKey);
			vscode.window.showInformationMessage('API Key updated successfully!');
		} else {
			vscode.window.showWarningMessage('No API Key entered. Some features may not work.');
		}
	}));

	if (!storedApiKey) {
		// Ask the user for the API key
		vscode.commands.executeCommand('dvise.setApiKey');
	}

	// 

	// Register file explorer
	const fileExplorer = new FileExplorerView(context);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('dvise.fileExplorer', fileExplorer));

	// Register chat panel command
	context.subscriptions.push(
		vscode.commands.registerCommand('dvise.openChat', () => {
			ChatPanel.createOrShow(context);
		})
	);

	// Register command to get the API key
	context.subscriptions.push(vscode.commands.registerCommand('dvise.getApiKey', async () => {
		return await context.secrets.get('openaiApiKey');
	}));


	// Open chat panel automatically when extension starts
	vscode.commands.executeCommand('dvise.openChat');

	// Register command to visualize code
	context.subscriptions.push(vscode.commands.registerCommand('dvise.visualizeCode', async (args) => {
		if (!args || !args.text || !args.document || !args.startLine) {
			vscode.window.showErrorMessage('No code to visualize.');
			return;
		}
		ChatPanel.handleMessage({ command: "dvise.sendMessage", text: `Visualize the following code: \n\n\`\`\`${args.document.languageId}\n${args.text}\`\`\``, context: { file: args.document.uri.toString(), startLine: args.startLine, text: `\`\`\`${args.document.languageId}\n${args.text}\n\`\`\`` } });
	}));


	// Register hover provider
	context.subscriptions.push(vscode.languages.registerHoverProvider({ scheme: 'file', language: '*' }, new HoverProvider()));

	// Register code lens provider for python, javascript, and java
	context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: 'file', language: '*' }, new VisualizeCodeLensProvider()));


}

export function deactivate() { }
