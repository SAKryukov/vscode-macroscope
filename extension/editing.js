/*

Copyright (c) Sergey A Kryukov
https://github.com/SAKryukov/vscode-yacc
https://www.SAKryukov.org

*/

"use strict";

exports.TextProcessor = function (vscode, definitionSet, languageEngine) {

    const indicatorReturn = 1, indicatorPause = 2;
    let stack = [], pause = null;

    const cursorMove = async (verb, unit, value, select) => {
        await vscode.commands.executeCommand(
            definitionSet.builtInCommands.cursorMove,
            { to: verb, by: unit, value: value, select: select }
        );
    }; //cursorMove

    const findNext = async backward => {
        const command = backward
            ? definitionSet.builtInCommands.findPrevious
            : definitionSet.builtInCommands.findNext;
        await vscode.commands.executeCommand(command);
    }; //findNext

    const moveToWord = (textEditor, select, start) => {
        const range = textEditor.document.getWordRangeAtPosition(textEditor.selection.start);
        if (!range) return;
        const finalPosition = start ? range.start : range.end;
        if (select) {
            if (start)
                textEditor.selection = new vscode.Selection(finalPosition, textEditor.selection.start);
            else
                textEditor.selection = new vscode.Selection(textEditor.selection.start, finalPosition);
        } else
            textEditor.selection = new vscode.Selection(finalPosition, finalPosition);
    } //moveToWord

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

    const moveSingleWord = (textEditor, backward, select) => {
        const selection = textEditor.selection;
        const line = textEditor.document.lineAt(selection.start);
        const lineRange = line.range;
        const lineText = line.text;
        const lineStart = textEditor.document.offsetAt(lineRange.start);
        const selectionAt = textEditor.document.offsetAt(selection.start);
        const subLine = backward
            ? lineText.substring(0, selectionAt - lineStart)
            : lineText.substring(selectionAt - lineStart);
        const relativeWordPosition = firstNonblank(subLine, backward);
        if (relativeWordPosition == null)
            return;
        const finalOffset = backward
            ? lineStart + relativeWordPosition
            : selectionAt + relativeWordPosition;
        const targetPosition = textEditor.document.positionAt(finalOffset);
        if (select)
            textEditor.selection = new vscode.Selection(selection.start, targetPosition);
        else
            textEditor.selection = new vscode.Selection(targetPosition, targetPosition);
    } //moveSingleWord

    const moveToAnotherWord = (textEditor, backward, value, select) => {
        for (let index = 0; index < value; ++index)
            moveSingleWord(textEditor, backward, select);
    } //moveToAnotherWord

    const push = textEditor => {
        stack.push(textEditor.selection.start);
    }; //push
    const pop = (textEditor, select) => {
        const position = stack.pop();
        if (!position) return;
        const newStart = select ? textEditor.selection.start : position;
        textEditor.selection = new vscode.Selection(newStart, position);
    }; //pop

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

    const deselect = (textEditor, location) => {
        const selection = textEditor.selection;
        if (selection.isEmpty) return;
        const position = location == languageEngine.enumerationMoveLocation.start
            ? selection.start : selection.end;
        textEditor.selection = new vscode.Selection(position, position);
    }; //deselect

    const offset = (textEditor, value, select, backward) => {
        const selection = textEditor.selection;
        const startOffset = textEditor.document.offsetAt(selection.start);
        if (backward) value = -value;
        let endOffset = startOffset + value;
        if (endOffset < 0) endOffset = 0;
        const finalPosition = textEditor.document.positionAt(endOffset);
        if (select)
            textEditor.selection = new vscode.Selection(selection.start, finalPosition);
        else
            textEditor.selection = new vscode.Selection(finalPosition, finalPosition);
    }; //offset

    const playOperation = async (textEditor, operation) => {
        let verbUnit = null;
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
                case languageEngine.enumerationMoveLocation.forward:
                    offset(textEditor, operation.value, operation.select, false);
                    break;
                case languageEngine.enumerationMoveLocation.backward:
                    offset(textEditor, operation.value, operation.select, true);
                    break;
                } //switch
            if (verbUnit) {
                if (operation.target == languageEngine.enumerationTarget.emptyLine)
                    for (let index = 0; index < operation.value; ++index)
                        await cursorMove(verbUnit.verb, verbUnit.unit, 1, operation.select);
                else
                    await cursorMove(verbUnit.verb, verbUnit.unit, operation.value, operation.select);
            } //if
            else if (operation.target == languageEngine.enumerationTarget.word) {
                switch (operation.move) {
                    case languageEngine.enumerationMoveLocation.start:
                        moveToWord(textEditor, operation.select, true);
                        break;
                    case languageEngine.enumerationMoveLocation.end:
                        moveToWord(textEditor, operation.select, false);
                        break;
                    case languageEngine.enumerationMoveLocation.next:
                        moveToAnotherWord(textEditor, false, operation.value, operation.select);
                        break;
                    case languageEngine.enumerationMoveLocation.previous:
                        moveToAnotherWord(textEditor, true, operation.value, operation.select);
                        break;
                } //swithch word moves not covered by cursorMove                  
            } //if word moves not covered by cursorMove
        } else {
            switch (operation.operation) { //non move:
                case languageEngine.enumerationOperation.text:
                    if (textEditor.selection.isEmpty)
                        await textEditor.edit(async builder => await builder.insert(textEditor.selection.start, operation.value));
                    else
                        await textEditor.edit(async builder => await builder.replace(textEditor.selection, operation.value));
                    break;
                case languageEngine.enumerationOperation.copy:
                    copyToClipboard(textEditor, textEditor.selection, operation.target);
                    break;
                case languageEngine.enumerationOperation.paste:
                    const text = vscode.env.clipboard.readText();
                    if (!text) return;
                    if (textEditor.selection.isEmpty)
                        await textEditor.edit(async builder => await builder.insert(textEditor.selection.start, text));
                    else
                        await textEditor.edit(async builder => await builder.replace(textEditor.selection, text));
                    break;
                case languageEngine.enumerationOperation.delete:
                    if (!textEditor.selection.isEmpty)
                        await textEditor.edit(async builder => await builder.replace(textEditor.selection, definitionSet.parsing.empty));
                case languageEngine.enumerationOperation.find:
                    const backward =
                        operation.move == languageEngine.enumerationMoveLocation.previous;
                    await findNext(backward);
                    break;
                case languageEngine.enumerationOperation.deselect:
                    deselect(textEditor, operation.move);
                    break;
                case languageEngine.enumerationOperation.push:
                    push(textEditor);
                    break;
                case languageEngine.enumerationOperation.pop:
                    pop(textEditor, operation.select);
                    break;                   
                case languageEngine.enumerationOperation.return:
                    return indicatorReturn;
                case languageEngine.enumerationOperation.pause:
                    return indicatorPause;
                } //switch non-move operation
        } //if
    }; //playOperation

    this.play = async function(textEditor, macro) {
        if (!macro) return;
        if (pause == null)
            stack = [];
        const startIndex = pause == null ? 0 : pause + 1;
        if (!macro[startIndex]) {
            macro == null;
            return;
        } //if
        for (let index = startIndex; index < macro.length; ++index) {
            const result = await playOperation(textEditor, macro[index]);
            if (result) {
                if (result == indicatorPause)
                    pause = index;
                break;
            } //if
            if (pause != null && index - 1 >= pause)
                pause = null;
        } //loop
        return pause != null;
    }; //this.play

    this.resetPause = () => pause = null;
    
};
