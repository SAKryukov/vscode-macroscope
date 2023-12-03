/*

Copyright (c) Sergey A Kryukov
https://github.com/SAKryukov/vscode-yacc
https://www.SAKryukov.org

*/

"use strict";

const vscode = require("vscode");
const fileSystem = require("fs");
const language = require("./language");
const definitionSet = require("./definitionSet").definitionSet;
const languageEngine = new language.RuleEngine(definitionSet);
const editing = require("./editing");
const textProcessor = new editing.TextProcessor(vscode, definitionSet, languageEngine);

exports.activate = context => {

    let macroEditor, macro;

    const updateMacroPlayVisibility = () => {
        vscode.commands.executeCommand(
            definitionSet.commands.setContext,
            definitionSet.commands.macroPlayVisibilityKey,
            vscode.window.activeTextEditor != null && macro != null);
    }; //updateMacroPlayVisibility

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => 
        updateMacroPlayVisibility()));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand(
        definitionSet.commands.macroPlay,
        textEditor => textProcessor.play(textEditor, macro)));
        
    context.subscriptions.push(vscode.commands.registerCommand(definitionSet.commands.macroEditor, () => {
            if (macroEditor != null) return; //SA??? make state
            macroEditor = vscode.window.createWebviewPanel(
                definitionSet.macroEditor.name,
                definitionSet.macroEditor.title,
                vscode.ViewColumn.Two,
                { enableScripts: true }
            ); //panel
            macroEditor.onDidDispose(() => macroEditor = null);
            macroEditor.webview.html = fileSystem.readFileSync(
                definitionSet.macroEditor.htmlFileName()).toString();
            macroEditor.webview.onDidReceiveMessage(message => {
                context.workspaceState.update(definitionSet.scriptPersistentStateKey, message.macro.innerHTML);
                const errors = languageEngine.parse(message.macro.text);
                macroEditor.webview.postMessage({ errors: errors });
                if (errors == null)
                    macro = languageEngine.operations;
                updateMacroPlayVisibility();
            }, undefined, context.subscriptions);
            const persistentMacro = context.workspaceState.get(definitionSet.scriptPersistentStateKey);
            if (persistentMacro)
                macroEditor.webview.postMessage({ innerHTML: persistentMacro });
        })); //macroEditor command

}; //exports.activate

exports.deactivate = () => { };
