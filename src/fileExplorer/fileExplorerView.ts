import * as vscode from 'vscode';
import * as path from 'path';

export class FileExplorerView implements vscode.TreeDataProvider<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | void> = new vscode.EventEmitter<FileItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) { }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileItem): Thenable<FileItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showInformationMessage('Open a folder to use the extension.');
            return Promise.resolve([]);
        }

        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        return Promise.resolve(this.getFiles(rootPath));
    }

    private getFiles(dir: string): FileItem[] {
        const fs = require('fs');
        const files = fs.readdirSync(dir);

        return files.map((file: string) => new FileItem(path.join(dir, file)));
    }
}

class FileItem extends vscode.TreeItem {
    constructor(public readonly fullPath: string) {
        super(path.basename(fullPath), vscode.TreeItemCollapsibleState.None);
        this.command = { command: 'fileExplorer.selectFile', title: 'Select File', arguments: [this] };
    }
}