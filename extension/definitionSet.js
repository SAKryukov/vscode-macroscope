/*
Macroscope

Copyright (c) 2023 by Sergey A Kryukov
https://github.com/SAKryukov/vscode-macroscope
https://www.SAKryukov.org
*/

"use strict";

exports.definitionSet = {
    commands: { // should be in sync with json com
        macroPlay: "macroscope.macro.play",
        macroEditor: "macroscope.macro.editor.start",
        macroPlayVisibilityKey: "macroscope.macro.play.visible",
    },
    builtInCommands: {
        setContext: "setContext",
        cursorMove: "cursorMove",
        findNext: "editor.action.nextMatchFindAction",
        findPrevious: "editor.action.previousMatchFindAction",
    },
    statusBar: {
        itemText: "Play macro",
        itemTextContinue: "Continue macro",
        itemTextNew: "Play new macro",
        flashContinueMacroTime: 500,
        flashContinueMacroBackground: "statusBarItem.errorBackground",
        // keep in sync with package:
        itemToolTip: "Use commands: Macroscope: Macro Editor, Macroscope: Play Macro"
    },
    macroEditor: {
        name: "macro.editor",
        title: "Macroscope Macro Editor",
        quickPickTitle: "Macro Editor",
        choiceShow: "Show",
        choiceEditorToText: "Macro script to text",
        choiceTextToMacro: "Text to macro script",
        choiceSelectionToMacro: "Selection to macro script",
        htmlFileName: () => __dirname + "/operations.html",
        lineToHtml: line => `<p>${line}</p>`,
    },
    value: {
        default: 1,
        maximumSize: 12, //SA???
    },
    parsing: {
        empty: "",
        blankspace: " ",
        comment: "//",
        textStart: "[",
        textEnd: "]",
        text: value => value.substring(1, value.length - 1),
        select: "select",
        unescape: text => text
            .replaceAll("\\\\n", "\0x01")
            .replaceAll("\\\\t", "\0x02")
            .replaceAll("\\\\", "\\")
            .replaceAll("\\n", "\n")
            .replaceAll("\\t", "\t")
            .replaceAll("\0x01", "\\n")
            .replaceAll("\0x02", "\\t")
    },
    typography: {
        lineSeparator: "\n",
        dotSeparator: ".",
        pathSeparator: "/",
        dashSeparator: "-",
        underscoreSeparator: "_",
    },
    scriptPersistentStateKey: "macro.editor.start.persistent.state",
};
