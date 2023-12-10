/*
Macroscope

Copyright (c) 2023 by Sergey A Kryukov
https://github.com/SAKryukov/vscode-macroscope
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

    const metadata = {
        version: context.extension.packageJSON.version,
        author: context.extension.packageJSON.author.name,
        authorUrl: context.extension.packageJSON.author.url,
        extensionDisplayName: context.extension.packageJSON.displayName,
    }; //metadata

    let macroEditor, macro, statusBarItem;

    const updateMacroPlayVisibility = () => {
        const isVisible = vscode.window.activeTextEditor != null && macro != null;
        if (!statusBarItem) {
            statusBarItem = vscode.window.createStatusBarItem(
            "macroscope.statusBarItem", // unused
            vscode.StatusBarAlignment.Left); // SA!!! I don't like vscode.StatusBarAlignment.Right,
                                             // because it requires pretty stupid "priority" argument
                statusBarItem.text = definitionSet.statusBar.itemText;
                statusBarItem.tooltip = definitionSet.statusBar.itemToolTip;
                statusBarItem.command = definitionSet.commands.macroPlay;
        } //if
        if (isVisible)
            statusBarItem.show();
        else
            statusBarItem.hide();
        vscode.commands.executeCommand(
            definitionSet.builtInCommands.setContext,
            definitionSet.commands.macroPlayVisibilityKey,
            isVisible);
    }; //updateMacroPlayVisibility

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => 
        updateMacroPlayVisibility()));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand(
        definitionSet.commands.macroPlay,
        textEditor => {
          const isVisible = vscode.window.activeTextEditor != null && macro != null;
          if (!isVisible) return;
            textProcessor.play(textEditor, macro).then(isPaused => {
                statusBarItem.text = isPaused
                    ? definitionSet.statusBar.itemTextContinue
                    : definitionSet.statusBar.itemText;
                if (isPaused) { //flash:
                    statusBarItem.backgroundColor = 
                        new vscode.ThemeColor(definitionSet.statusBar.flashContinueMacroBackground);
                    setTimeout(() => {
                        statusBarItem.backgroundColor = null;
                    }, definitionSet.statusBar.flashContinueMacroTime);
                } //if Paused
            });
        })); //macro Play command
        
    const editorMenu = () => {
        const result = [];
        if (macroEditor == null)
            result.push(definitionSet.macroEditor.choiceShow);
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return result;
        result.push(definitionSet.macroEditor.choiceEditorToText);
        if (editor.document.getText().trim().length > 0)
            result.push(definitionSet.macroEditor.choiceTextToMacro);
        if (!editor.selection.isEmpty) {
            if (editor.document.getText(editor.selection).trim().length > 0)
            result.push(definitionSet.macroEditor.choiceSelectionToMacro);
        } //if
        return result;
    } //editorMenu

    const showEditor = macroHtml => {
        if (macroEditor != null) return; //SA??? make state
        macroEditor = vscode.window.createWebviewPanel(
            definitionSet.macroEditor.name,
            definitionSet.macroEditor.title,
            vscode.ViewColumn.Two,
            { enableScripts: true }
        ); //panel
        macroEditor.onDidDispose(() => macroEditor = null);
        macroEditor.webview.html = fileSystem.readFileSync(
            definitionSet.macroEditor.htmlFileName()).toString()
            .replace("?product?", metadata.extensionDisplayName)
            .replace("?version?", metadata.version);
        macroEditor.webview.onDidReceiveMessage(message => {
            context.workspaceState.update(definitionSet.scriptPersistentStateKey, message.macro.innerHTML);
            const errors = languageEngine.parse(message.macro.text);
            macroEditor.webview.postMessage({ errors: errors });
            if (errors == null) {
                textProcessor.resetPause();
                macro = languageEngine.operations;
                statusBarItem.text = definitionSet.statusBar.itemTextNew;
            } //if
            updateMacroPlayVisibility();
        }, undefined, context.subscriptions);
        if (!macroHtml)
            macroHtml = context.workspaceState.get(definitionSet.scriptPersistentStateKey);
        if (macroHtml)
            macroEditor.webview.postMessage({ innerHTML: macroHtml });
    }; //showEditor

    context.subscriptions.push(vscode.commands.registerCommand(definitionSet.commands.macroEditor, () => {
        const choiceSet = editorMenu();
        vscode.window.showQuickPick(choiceSet, {
            placeHolder: definitionSet.macroEditor.choiceShow,
            canPickMany: false
        }).then(choice => {
            switch (choice) {
                case definitionSet.macroEditor.choiceShow:
                    showEditor(null);
                    break;
                case definitionSet.macroEditor.choiceEditorToText:
                    //SA???
                    break;
                case definitionSet.macroEditor.choiceTextToMacro:
                    showEditor("move left");
                    break;
                case definitionSet.macroEditor.choiceSelectionToMacro:
                    showEditor("move right");
                    break;
            } //switch choice
        }); //showQuickick 
    })); //macroEditor command

}; //exports.activate

exports.deactivate = () => { };
