import * as vscode from 'vscode';

export async function getAllFilesInWorkspace(): Promise<{ role: 'user' | 'assistant' | 'system'; content: string }[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];

    const allFiles: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];

    for (const folder of workspaceFolders) {
        await collectFiles(folder.uri, allFiles);
    }

    return allFiles;
}

async function collectFiles(dir: vscode.Uri, collected: { role: 'user' | 'assistant' | 'system'; content: string }[]) {
    const entries = await vscode.workspace.fs.readDirectory(dir);

    for (const [name, fileType] of entries) {
        if (name.startsWith('.')) continue; // Skip hidden files/folders

        const fullPath = vscode.Uri.joinPath(dir, name);

        if (fileType === vscode.FileType.Directory) {
            await collectFiles(fullPath, collected); // Recurse into folder
        } else if (fileType === vscode.FileType.File) {
            try {
                const doc = await vscode.workspace.openTextDocument(fullPath);
                const content = `${fullPath.fsPath}\n\n\`\`\`${doc.languageId}\n${doc.getText()}\`\`\``;
                collected.push({ role: 'system', content });
            } catch (err) {
                console.warn(`Failed to open file ${fullPath.fsPath}:`, err);
            }
        }
    }
}