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

    const createStatusBarItem = () => {
        if (statusBarItem) return;
        statusBarItem = vscode.window.createStatusBarItem(
            "macroscope.statusBarItem", // unused
            vscode.StatusBarAlignment.Left); // SA!!! I don't like vscode.StatusBarAlignment.Right,
                                             // because it requires pretty stupid "priority" argument
                statusBarItem.text = definitionSet.statusBar.itemText;
                statusBarItem.tooltip = definitionSet.statusBar.itemToolTip;
                statusBarItem.command = definitionSet.commands.macroPlay;
    }; //createStatusBarItem

    const updateMacroPlayVisibility = () => {
        const isVisible = vscode.window.activeTextEditor != null && macro != null;
        createStatusBarItem();      
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
                createStatusBarItem();
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

    const handleMacro = macroText => {
        const errors = languageEngine.parse(macroText);
        macroEditor.webview.postMessage({ errors: errors });
        if (errors == null) {
            textProcessor.resetPause();
            macro = languageEngine.operations;
            createStatusBarItem();
            statusBarItem.text = definitionSet.statusBar.itemTextNew;
        } //if 
    } //handleMacro

    const pushMacro = macroText => {
        if (macroEditor == null) return;
        if (macroText == null)
            macroText = context.workspaceState.get(definitionSet.scriptPersistentStateKey);
        else
            context.workspaceState.update(definitionSet.scriptPersistentStateKey, macroText);
        if (macroText == null) return;
        macroEditor.webview.postMessage({ text: macroText });
        handleMacro(macroText);
    }; //pushMacro

    const requestMacroForSaveAs = () => {
        macroEditor?.webview.postMessage({ requestForSaveAs: true });
    }; //requestMacroForSaveAs
    const requestMacroForPersistence = () => {
        macroEditor?.webview.postMessage({ requestForPersistence: true });
    }; //requestMacroForPersistence

    const showEditor = () => {
        if (macroEditor != null)
            macroEditor.reveal();
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
            if (message.macro.requestForSaveAs) {
                addMacroToText(message.macro.text);
            } else if (message.macro.requestForPersistence) {
                context.workspaceState.update(definitionSet.scriptPersistentStateKey, message.macro.text);    
            } else {
                context.workspaceState.update(definitionSet.scriptPersistentStateKey, message.macro.text);
                handleMacro(message.macro.text);
            } //if on request
            updateMacroPlayVisibility();
        }, undefined, context.subscriptions);
        const indicatingViewType = macroEditor.viewType;
        // SA!!! workaround due to the present VSCode bug #71339,
        // onDidChangeViewState event not fired
        // https://github.com/Microsoft/vscode/issues/71339:
        vscode.window.tabGroups.onDidChangeTabs(event => {
            const editorChange = arrayElement =>
                arrayElement.input.viewType && arrayElement.input.viewType.endsWith(indicatingViewType);
            let hasEditorChange = false;
            for (const element of event.changed) {
                if (editorChange(element)) { hasEditorChange = true; break; }
            } //loop
            if (hasEditorChange)
                pushMacro(null);
            else
                requestMacroForPersistence();
        }); //vscode.window.tabGroups.onDidChangeTabs
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
                    requestMacroForSaveAs();
                    break;
                case definitionSet.macroEditor.choiceTextToMacro:
                    pushMacro(extractMacroText());
                    break;
                case definitionSet.macroEditor.choiceSelectionToMacro:
                    pushMacro(extractMacroText(true));
                    break;
            } //switch choice
        }); //showQuickick 
    })); //macroEditor command

}; //exports.activate

exports.deactivate = () => { };
