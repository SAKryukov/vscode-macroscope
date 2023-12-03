/*

Copyright (c) Sergey A Kryukov
https://github.com/SAKryukov/vscode-yacc
https://www.SAKryukov.org

*/

"use strict";

exports.TextProcessor = function (vscode, definitionSet, languageEngine) {

    const cursorMove = async (verb, unit, value, select) => {
        await vscode.commands.executeCommand(
            "cursorMove",
            { to: verb, by: unit, value: value, select: select }
        );
    }; //cursorMove

    const moveToWord = async (textEditor, start) => {
        const range = textEditor.document.getWordRangeAtPosition(textEditor.selection.start);
        const direction = start ? "left" : "right";
        if (range) {
            const offsetStart = textEditor.document.offsetAt(range.start);
            const offsetEnd = textEditor.document.offsetAt(range.end);
            const currentOffset = textEditor.document.offsetAt(textEditor.selection.start);
            const size = start ? currentOffset - offsetStart : offsetEnd - currentOffset;
            await cursorMove(direction, "character", size, false);
        } //if
    } //moveToWord

    const findNext = async backward => {
        const command = backward
            ? "editor.action.previousMatchFindAction"
            : "editor.action.nextMatchFindAction"
        await vscode.commands.executeCommand(command);
    }; //findNext

    const firstNonblank = (line, backward) => {
        const marker = " ";
        const relativeWordPosition = backward
            ? line.lastIndexOf(marker)
            : line.indexOf(marker);
        if (relativeWordPosition < 0) return null;
        const lastIndex = backward
            ? 0
            : line.length - 1;
        if (backward) {
            for (let index = relativeWordPosition; index >= lastIndex; --index)
                if (line[index] != marker)
                    return index + 1;
        } else {
            for (let index = relativeWordPosition; index < lastIndex; ++index)
                if (line[index] != marker)
                    return index;
        } //if
        return null;
    }; //firstNonblank

    const moveToAnotherWord = async (textEditor, backward) => {
        const selection = textEditor.selection
        const line = textEditor.document.lineAt(selection.start);
        const lineRange = line.range;
        const lineText = line.text;
        const lineStart = textEditor.document.offsetAt(lineRange.start);
        const selectionAt = textEditor.document.offsetAt(selection.start);
        const subLine = backward
            ? lineText.substring(0, selectionAt)
            : lineText.substring(selectionAt);
        const relativeWordPosition = firstNonblank(subLine, backward);
        if (relativeWordPosition == null)
            return;
        const targetOffset = backward
            ? lineStart + relativeWordPosition
            : selectionAt + relativeWordPosition;
        const direction = backward ? "left" : "right";
        const size = backward
            ? selectionAt - targetOffset
            : targetOffset - selectionAt;
        await cursorMove(direction, "character", size, false);
    } //moveToAnotherWord

    const setCursorMagicWords = (verb, unit) => { return { verb: verb, unit: unit }; };

    const copyToClipboard = (textEditor, target) => {
        let range, line;
        if (target == null)
            return vscode.env.clipboard.writeText(textEditor.document.getText(textEditor.selection));
        switch (target) {
            case languageEngine.enumerationTarget.word:
                range = textEditor.document.getWordRangeAtPosition(textEditor.selection.start);
                break;
            case languageEngine.enumerationTarget.trimmedLine:
            case languageEngine.enumerationTarget.line:
                line = textEditor.document.lineAt(textEditor.selection.start);
                range = line?.range;
                break;
        } //switch target
        if (!range) return;
        if (target == languageEngine.enumerationTarget.trimmedLine) {
            const lineText = line.text;
            const offsetLeft = lineText.length - lineText.trimLeft().length;
            const offestRight = lineText.length - lineText.trimRight().length;
            const startPositionOffest = textEditor.document.offsetAt(range.start) + offsetLeft;
            const endPositionOffest = textEditor.document.offsetAt(range.end) - offestRight;
            const startPosition = textEditor.document.positionAt(startPositionOffest);
            const endPosition = textEditor.document.positionAt(endPositionOffest);
            range = range.with(startPosition, endPosition);
        } //if
        vscode.env.clipboard.writeText(textEditor.document.getText(range));
    }; //copyToClipboard

    const deselect = async (textEditor, location) => {
        if (textEditor.selection.isEmpty) return;
        const verb = location == languageEngine.enumerationMoveLocation.start
            ? "left" : "right";
        await cursorMove(verb, "character", 1, false);
    }; //deselect

    this.play = async function(textEditor, macro) {
        if (!macro) return;
        let verbUnit = null;
        for (const operation of macro) {
            if (operation.operation == languageEngine.enumerationOperation.move) {
                switch (operation.move) {
                    case languageEngine.enumerationMoveLocation.increment:
                        if (operation.target == languageEngine.enumerationTarget.character)
                            verbUnit = setCursorMagicWords("right", "character");
                        else if (operation.target == languageEngine.enumerationTarget.line)
                            verbUnit = setCursorMagicWords("down", "character");
                        break;
                    case languageEngine.enumerationMoveLocation.decrement:
                        if (operation.target == languageEngine.enumerationTarget.character)
                            verbUnit = setCursorMagicWords("left", "line");
                        else if (operation.target == languageEngine.enumerationTarget.line)
                            verbUnit = setCursorMagicWords("up", "line");
                        break;
                    case languageEngine.enumerationMoveLocation.start:
                        if (operation.target == languageEngine.enumerationTarget.line)
                            verbUnit = setCursorMagicWords("wrappedLineStart", "line");
                        else if (operation.target == languageEngine.enumerationTarget.trimmedLine)
                            verbUnit = setCursorMagicWords("wrappedLineFirstNonWhitespaceCharacter", "line");
                        break;
                    case languageEngine.enumerationMoveLocation.end:
                        if (operation.target == languageEngine.enumerationTarget.line)
                            verbUnit = setCursorMagicWords("wrappedLineEnd", "line");
                        else if (operation.target == languageEngine.enumerationTarget.trimmedLine)
                            verbUnit = setCursorMagicWords("wrappedLineLastNonWhitespaceCharacter", "line");
                        break;
                    case languageEngine.enumerationMoveLocation.next:
                        if (operation.target == languageEngine.enumerationTarget.emptyLine)
                            verbUnit = setCursorMagicWords("nextBlankLine", "line");
                        break;
                    case languageEngine.enumerationMoveLocation.previous:
                        if (operation.target == languageEngine.enumerationTarget.emptyLine)
                            verbUnit = setCursorMagicWords("prevBlankLine", "line");
                        break;
                } //switch
                if (verbUnit)
                    await cursorMove(verbUnit.verb, verbUnit.unit, operation.value, operation.select);
                else if (operation.target == languageEngine.enumerationTarget.word) {
                    switch (operation.move) {
                        case languageEngine.enumerationMoveLocation.start:
                            await moveToWord(textEditor, true);
                            break;
                        case languageEngine.enumerationMoveLocation.end:
                            await moveToWord(textEditor, false);
                            break;
                        case languageEngine.enumerationMoveLocation.next:
                            await moveToAnotherWord(textEditor, false);
                            break;
                        case languageEngine.enumerationMoveLocation.previous:
                            await moveToAnotherWord(textEditor, true);
                            break;
                    } //swithch word moves not covered by cursorMove                  
                } //if word moves not covered by cursorMove
            } else {
                switch (operation.operation) { //non move:
                    case languageEngine.enumerationOperation.text:
                        if (textEditor.selection.isEmpty)
                            await textEditor.edit(builder => builder.insert(textEditor.selection.start, operation.value));
                        else
                            await textEditor.edit(builder => builder.replace(textEditor.selection, operation.value));
                        break;
                    case languageEngine.enumerationOperation.copy:
                        copyToClipboard(textEditor, textEditor.selection, operation.target);
                        break;
                    case languageEngine.enumerationOperation.paste:
                        const text = vscode.env.clipboard.readText();
                        if (!text) return;
                        if (textEditor.selection.isEmpty)
                            await textEditor.edit(builder => builder.insert(textEditor.selection.start, text));
                        else
                            await textEditor.edit(builder => builder.replace(textEditor.selection, text));
                        break;
                    case languageEngine.enumerationOperation.delete:
                        if (!textEditor.selection.isEmpty)
                            await textEditor.edit(builder => builder.replace(textEditor.selection, definitionSet.parsing.empty));
                        case languageEngine.enumerationOperation.find:
                            const backward =
                                operation.move == languageEngine.enumerationMoveLocation.previous;
                            await findNext(backward);
                            break;
                        case languageEngine.enumerationOperation.deselect:
                        await deselect(textEditor, operation.move);
                        break;
                } //switch non-move operation
            } //if
        } //loop
    }; //this.play
    
};
