/*
Macrosocope

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
        // keep in sync with package:
        itemToolTip: "Use commands: Macroscope: Macro Editor, Macroscope: Play Macro"
    },
    macroEditor: {
        name: "macro.editor",
        title: "Macroscope Macro Editor",
        htmlFileName: () => __dirname + "/operations.html",
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
