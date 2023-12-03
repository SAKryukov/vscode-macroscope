/*

Copyright (c) Sergey A Kryukov
https://github.com/SAKryukov/vscode-yacc
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
    macroEditor: {
        name: "macro.editor",
        title: "Macroscope Macro Editor",
        htmlFileName: () => __dirname + "/operations.html",
    },
    value: {
        default: 1,
        maximumSize: 3, //SA???
    },
    parsing: {
        empty: "",
        blankpace: " ",
        comment: "//",
        textStart: "[",
        textEnd: "]",
        text: value => value.substring(1, value.length - 1),
    },
    scriptPersistentStateKey: "macro.editor.start.persistent.state",
};
