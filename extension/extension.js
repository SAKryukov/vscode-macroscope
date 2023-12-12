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
        result.push(definitionSet.macroEditor.choiceShow);
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return result;
        if (macroEditor != null)
            result.push(definitionSet.macroEditor.choiceEditorToText);
        if (editor.document.getText().trim().length > 0)
            result.push(definitionSet.macroEditor.choiceTextToMacro);
        if (!editor.selection.isEmpty) {
            if (editor.document.getText(editor.selection).trim().length > 0)
            result.push(definitionSet.macroEditor.choiceSelectionToMacro);
        } //if
        return result;
    } //editorMenu
    
    const extractMacroText = useSelection => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const text = useSelection
            ? editor.document.getText(editor.selection).trim()
            : editor.document.getText().trim();
        return text;
    }; //extractMacroText

    const addMacroToText = text => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        textProcessor.placeText(editor, text);
    }; //addMacroToText

    const showEditor = macroText => {
        if (macroEditor != null)
            macroEditor.reveal();
        const pushMacroHtml = () => {
            if (!macroText)
                macroText = context.workspaceState.get(definitionSet.scriptPersistentStateKey);
            if (macroText)
                macroEditor.webview.postMessage({ text: macroText });
        } // pushMacroHtml
        if (macroEditor != null) {
            pushMacroHtml();
            return;
        } //if
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
            if (message.macro.onRequest) {
                addMacroToText(message.macro.text);
            } else {
                context.workspaceState.update(definitionSet.scriptPersistentStateKey, message.macro.text);
                const errors = languageEngine.parse(message.macro.text);
                macroEditor.webview.postMessage({ errors: errors });
                if (errors == null) {
                    textProcessor.resetPause();
                    macro = languageEngine.operations;
                    statusBarItem.text = definitionSet.statusBar.itemTextNew;
                } //if    
            } //if on request
            updateMacroPlayVisibility();
        }, undefined, context.subscriptions);
        pushMacroHtml();
        vscode.window.tabGroups.onDidChangeTabs(event => {
            console.log(event);
        });
    }; //showEditor

    context.subscriptions.push(vscode.commands.registerCommand(definitionSet.commands.macroEditor, () => {
        const choiceSet = editorMenu();
        vscode.window.showQuickPick(choiceSet, {
            placeHolder: definitionSet.macroEditor.quickPickTitle,
            canPickMany: false
        }).then(choice => {
            switch (choice) {
                case definitionSet.macroEditor.choiceShow:
                    showEditor(null);
                    break;
                case definitionSet.macroEditor.choiceEditorToText:
                    macroEditor.webview.postMessage({ request: true });
                    break;
                case definitionSet.macroEditor.choiceTextToMacro:
                    showEditor(extractMacroText());
                    break;
                case definitionSet.macroEditor.choiceSelectionToMacro:
                    showEditor(extractMacroText(true));
                    break;
            } //switch choice
        }); //showQuickick 
    })); //macroEditor command

}; //exports.activate

exports.deactivate = () => { };
