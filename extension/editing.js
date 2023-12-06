/*

Copyright (c) Sergey A Kryukov
https://github.com/SAKryukov/vscode-yacc
https://www.SAKryukov.org

*/

"use strict";

exports.TextProcessor = function (vscode, definitionSet, languageEngine) {

    const indicatorReturn = 1, indicatorPause = 2;
    let positionStack = [], textStack = [], pause = null;

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

    const setSelection = (textEditor, finalPosition, select) =>
        textEditor.selection = new vscode.Selection(
            select ? textEditor.selection.start : finalPosition,
            finalPosition
        );

    const moveToWord = (textEditor, select, start) => {
        const range = textEditor.document.getWordRangeAtPosition(textEditor.selection.start);
        if (!range) return;
        const finalPosition = start ? range.start : range.end;
        setSelection(textEditor, finalPosition, select);
    } //moveToWord

    const validatePosition = (document, position) => {
        const adjustedPosition = document.validatePosition(position);
        return adjustedPosition.isEqual(position);
    } //new vscode.Position(lineNumber, 0)

    const moveToSingleWord = (textEditor, backward, select) => {
        const increment = backward ? -1 : 1;
        let position = textEditor.selection.start;
        let word = textEditor.document.getWordRangeAtPosition(position);
        if (word && backward) {
            if (position.isEqual(word.start)) {
                if (backward && position.character == 0) return;
                position = position.translate(0, increment);
                if (!validatePosition(textEditor.document, position))
                    return;
            } else {
                setSelection(textEditor, word.start, select);
                return;
            } //if
        } else if (word) {
            position = word.end.translate(0, increment);
            if (!validatePosition(textEditor.document, position)) {
                setSelection(
                    textEditor,
                    textEditor.document.lineAt(textEditor.selection.start).range.end,
                    select);
                return;
            } //if           
        } //if
        while (true) {
            word = textEditor.document.getWordRangeAtPosition(position);
            if (word)
                break;
            else {
                if (backward && position.character == 0) {
                    setSelection(
                        textEditor,
                        textEditor.document.lineAt(textEditor.selection.start).range.start,
                        select);
                    return;
                } //if
                position = position.translate(0, increment);
            } //if
            if (!validatePosition(textEditor.document, position))
                break;
        } //loop
        if (!word) return;
        setSelection(textEditor, word.start, select);
    } //moveToSingleWord

    const moveToAnotherWord = (textEditor, backward, value, select) => {
            for (let index = 0; index < value; ++index)
            moveToSingleWord(textEditor, backward, select);
    } //moveToAnotherWord

    const push = textEditor => {
        positionStack.push(textEditor.selection.start);
    }; //push
    const pop = (textEditor, select) => {
        const position = positionStack.pop();
        if (!position) return;
        const newStart = select ? textEditor.selection.start : position;
        textEditor.selection = new vscode.Selection(newStart, position);
    }; //pop

    const setCursorMagicWords = (verb, unit) => { return { verb: verb, unit: unit }; };

    const copyToClipboard = async (textEditor, target) => {
        let range, line;
        if (target == null)
            return await vscode.env.clipboard.writeText(textEditor.document.getText(textEditor.selection));
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
        await vscode.env.clipboard.writeText(textEditor.document.getText(range));
    }; //copyToClipboard

    const deselect = (textEditor, location) => {
        const selection = textEditor.selection;
        if (selection.isEmpty) return;
        const position = location == languageEngine.enumerationMove.start
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
        setSelection(textEditor, finalPosition, select);
    }; //offset

    const getSelectionRange = textEditor =>
        new vscode.Selection(textEditor.selection.start, textEditor.selection.end);
    const getWordRange = textEditor =>
        textEditor.document.getWordRangeAtPosition(textEditor.selection.start);
    const getLineRange = textEditor =>
        textEditor.document.lineAt(textEditor.selection.start).range;
    const getTrimmedLineRange = textEditor => {
        const range = textEditor.document.lineAt(textEditor.selection.start).range;
        const text = textEditor.document.getText(range);
        const fullLength = text.length;
        const offsetLeft = fullLength - text.trimLeft().length;
        const offsetRight = fullLength - text.trimRight().length;
        const offsetStart = textEditor.document.offsetAt(range.start) + offsetLeft;
        const offsetEnd = textEditor.document.offsetAt(range.end)- offsetRight;
        const positionStart = textEditor.document.positionAt(offsetStart);
        const positionEnd = textEditor.document.positionAt(offsetEnd);
        return new vscode.Range(positionStart, positionEnd);
    }; //getTrimmedLineRange

    const pushText = (textEditor, range) => {
        if (!range) return;
        textStack.push(textEditor.document.getText(range));
    }; //pushText

    const placeText = async (textEditor, text) => {
        if (textEditor.selection.isEmpty)
            await textEditor.edit(async builder => await builder.insert(textEditor.selection.start, text));
        else
            await textEditor.edit(async builder => await builder.replace(textEditor.selection, text));
    }; //placeText

    const popText = async textEditor => {
        const text = textStack.pop();
        if (!text) return;
        await placeText(textEditor, text);
    }; //popText

    const findNthMatch = (text, pattern, backward, count) => {
        let position; 
        let result;
        for (let index = 0; index < count; ++index) {
            if (position == undefined)
                position = backward ? text.length - 1 : 0;
            else
                position = backward ? position - pattern.length : position + pattern.length;
            if (position < 0) return null;
            result = backward ? text.lastIndexOf(pattern, position) : text.indexOf(pattern, position);
            if (result < 0)
                return null;
        } //loop
        return result;
    }; //findNthMatch

    const moveToMatchInOneLine = (textEditor, value, select, backward, lineNumber) => {
        const line = textEditor.document.lineAt(new vscode.Position(lineNumber, 0));
        if (!line) return;
        const lineRange = line.range;
        const text = line.text;
        const index = findNthMatch(text, value.text, backward, value.value);
        if (!index || index < 0) return;
        const offsetStart = textEditor.document.offsetAt(lineRange.start) + index;
        const offsetEnd = offsetStart + value.text.length;
        const positionStart = textEditor.document.positionAt(offsetStart);
        const positionEnd = textEditor.document.positionAt(offsetEnd);
        textEditor.selection = select
            ? new vscode.Selection(positionStart, positionEnd)
            : new vscode.Selection(positionStart, positionStart);
        return true;
    }; //moveToMatchInOneLine

    const moveToMatchInLine = (textEditor, value, select, backward) => {
        let lineNumber = textEditor.document.lineAt(textEditor.selection.start).range.start.line;
        const increment = backward ? -1 : 1;
        while (lineNumber >= 0) {
            if (!validatePosition(textEditor.document, new vscode.Position(lineNumber, 0)))
                return;
            const result = moveToMatchInOneLine(textEditor, value, select, backward, lineNumber);
            if (result) return;
            lineNumber = lineNumber + increment;
        } //loop
    }; //moveToMatchInLine

    const playOperation = async (textEditor, operation) => {
        if (operation.operation == languageEngine.enumerationOperation.move) {
            let verbUnit = null;
            switch (operation.move) {
                case languageEngine.enumerationMove.increment:
                    if (operation.target == languageEngine.enumerationTarget.character)
                        verbUnit = setCursorMagicWords("right", "character");
                    else if (operation.target == languageEngine.enumerationTarget.line)
                        verbUnit = setCursorMagicWords("down", "character");
                    break;
                case languageEngine.enumerationMove.decrement:
                    if (operation.target == languageEngine.enumerationTarget.character)
                        verbUnit = setCursorMagicWords("left", "line");
                    else if (operation.target == languageEngine.enumerationTarget.line)
                        verbUnit = setCursorMagicWords("up", "line");
                    break;
                case languageEngine.enumerationMove.start:
                    if (operation.target == languageEngine.enumerationTarget.line)
                        verbUnit = setCursorMagicWords("wrappedLineStart", "line");
                    else if (operation.target == languageEngine.enumerationTarget.trimmedLine)
                        verbUnit = setCursorMagicWords("wrappedLineFirstNonWhitespaceCharacter", "line");
                    break;
                case languageEngine.enumerationMove.end:
                    if (operation.target == languageEngine.enumerationTarget.line)
                        verbUnit = setCursorMagicWords("wrappedLineEnd", "line");
                    else if (operation.target == languageEngine.enumerationTarget.trimmedLine)
                        verbUnit = setCursorMagicWords("wrappedLineLastNonWhitespaceCharacter", "line");
                    break;
                case languageEngine.enumerationMove.next:
                    if (operation.target == languageEngine.enumerationTarget.emptyLine)
                        verbUnit = setCursorMagicWords("nextBlankLine", "line");
                    break;
                case languageEngine.enumerationMove.previous:
                    if (operation.target == languageEngine.enumerationTarget.emptyLine)
                        verbUnit = setCursorMagicWords("prevBlankLine", "line");
                    break;
                case languageEngine.enumerationMove.forward:
                    offset(textEditor, operation.value, operation.select, false);
                    break;
                case languageEngine.enumerationMove.backward:
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
                    case languageEngine.enumerationMove.start:
                        moveToWord(textEditor, operation.select, true);
                        break;
                    case languageEngine.enumerationMove.end:
                        moveToWord(textEditor, operation.select, false);
                        break;
                    case languageEngine.enumerationMove.next:
                        moveToAnotherWord(textEditor, false, operation.value, operation.select);
                        break;
                    case languageEngine.enumerationMove.previous:
                        moveToAnotherWord(textEditor, true, operation.value, operation.select);
                        break;
                    } //swithch word moves not covered by cursorMove                  
            } else if (operation.move == languageEngine.enumerationMove.matchInLine) {
                moveToMatchInLine(textEditor,
                    operation.value, operation.select,
                    operation.target == languageEngine.enumerationTarget.backward);
            } //if
        } else {
            switch (operation.operation) { //non move:
                case languageEngine.enumerationOperation.text:
                    await placeText(textEditor, operation.value);
                case languageEngine.enumerationOperation.copy:
                    await copyToClipboard(textEditor, operation.target);
                    break;
                case languageEngine.enumerationOperation.paste:
                    const text = await vscode.env.clipboard.readText();
                    if (!text) return;
                    await placeText(textEditor, text);
                    break;
                case languageEngine.enumerationOperation.delete:
                    if (!textEditor.selection.isEmpty)
                        await textEditor.edit(async builder => await builder.replace(textEditor.selection, definitionSet.parsing.empty));
                    break;
                case languageEngine.enumerationOperation.find:
                    const backward =
                        operation.move == languageEngine.enumerationMove.previous;
                    await findNext(backward);
                    break;
                case languageEngine.enumerationOperation.deselect:
                    deselect(textEditor, operation.move);
                    break;
                case languageEngine.enumerationOperation.pushPosition:
                    push(textEditor);
                    break;
                case languageEngine.enumerationOperation.popPosition:
                    pop(textEditor, operation.select);
                    break;     
                case languageEngine.enumerationOperation.pushText:
                    switch (operation.target) {
                        case languageEngine.enumerationTarget.selection:
                            pushText(textEditor, getSelectionRange(textEditor));
                            break;
                        case languageEngine.enumerationTarget.word:
                            pushText(textEditor, getWordRange(textEditor));
                            break;
                        case languageEngine.enumerationTarget.trimmedLine:
                            pushText(textEditor, getTrimmedLineRange(textEditor));
                            break;
                        case languageEngine.enumerationTarget.line:
                            pushText(textEditor, getLineRange(textEditor));
                            break;
                    } // switch operation.target
                    break;                   
                case languageEngine.enumerationOperation.popText:
                    await popText(textEditor);
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
        if (pause == null) {
            positionStack = [];
            textStack = [];
        } //if
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
