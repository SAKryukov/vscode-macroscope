/*
Macrosocope

Copyright (c) 2023 by Sergey A Kryukov
https://github.com/SAKryukov/vscode-macroscope
https://www.SAKryukov.org
*/

"use strict";

exports.RuleEngine = function(definitionSet) {

    const utility = {
        preprocessEnumeration: type => {
            const names = Object.getOwnPropertyNames(type);
            let index = 0;
            for (const name of names)
                type[name] = index++;
            Object.freeze(type);
        },
    }; //utility

    this.enumerationOperation = {
        move: 0, text: 0, copy: 0, paste: 0, select: 0, delete: 0, swapSelection: 0, find: 0,
        deselect: 0, pushPosition: 0, popPosition: 0, pause: 0, return: 0,
        pushText: 0, popText: 0, caseConversion: 0,
    }; //enumerationOperation
    this.enumerationTarget = {
        character: 0, line: 0, trimmedLine: 0, emptyLine: 0, f: 0, selection: 0,
        forward: 0, backward: 0, // not enumerationMove.forward or .backward! used with numerationMove,matchInLine
    };
    this.enumerationMove = {
        increment: 0, decrement: 0, start: 0, end: 0, next: 0, previous: 0,
        forward: 0, backward: 0, matchInLine: 0,
    };
    this.enumerationCaseConversion = {
        lower: 0, upper: 0, title: 0, camel: 0, toggle: 0,
        members: 0, kebab: 0, snake: 0,
        splitByCase: 0, removePunctuation: 0,
    };
    utility.preprocessEnumeration(this.enumerationOperation);
    utility.preprocessEnumeration(this.enumerationTarget);
    utility.preprocessEnumeration(this.enumerationMove);
    utility.preprocessEnumeration(this.enumerationCaseConversion);

    const MacroOperation = function(operation, target, move, value, select, index) {
        this.operation = operation; //this.enumerationOperation
        /*
        this.target = target; //this.enumerationTarget
        this.move = move; //this.enumerationMoveLocation
        this.caseConversion =... //this.enumerationCaseConversion
        this.value = value; //number of steps or text to insert/replace
        this.select = select;
        this.index = index;
        */
    }; //MacroOperation

    const operationMap = (() => {
        const map = new Map();
        map.set("move", macroOperation => macroOperation.operation = this.enumerationOperation.move);
        map.set("copy", macroOperation => macroOperation.operation = this.enumerationOperation.copy);
        map.set("copy-word", macroOperation => {
            macroOperation.operation = this.enumerationOperation.copy;
            macroOperation.target = this.enumerationTarget.word;
        });
        map.set("copy-line", macroOperation => {
            macroOperation.operation = this.enumerationOperation.copy;
            macroOperation.target = this.enumerationTarget.line;
        });
        map.set("copy-trimmed-line", macroOperation => {
            macroOperation.operation = this.enumerationOperation.copy;
            macroOperation.target = this.enumerationTarget.trimmedLine;
        });
        map.set("paste", macroOperation => macroOperation.operation = this.enumerationOperation.paste);
        map.set("select-word", macroOperation => {
            macroOperation.operation = this.enumerationOperation.select;
            macroOperation.target = this.enumerationTarget.word;
        });
        map.set("select-line", macroOperation => {
            macroOperation.operation = this.enumerationOperation.select;
            macroOperation.target = this.enumerationTarget.line;
        });
        map.set("delete", macroOperation => macroOperation.operation = this.enumerationOperation.delete);
        map.set("swap", macroOperation => macroOperation.operation = this.enumerationOperation.swapSelection);
        map.set("find-next", macroOperation => {
            macroOperation.operation = this.enumerationOperation.find;
            macroOperation.move = this.enumerationMove.next;
        });
        map.set("find-previous", macroOperation => {
            macroOperation.operation = this.enumerationOperation.find;
            macroOperation.move = this.enumerationMove.previous;
        });
        map.set("deselect-start", macroOperation => {
            macroOperation.operation = this.enumerationOperation.deselect;
            macroOperation.move = this.enumerationMove.start;
        });
        map.set("deselect-end", macroOperation => {
            macroOperation.operation = this.enumerationOperation.deselect;
            macroOperation.move = this.enumerationMove.end;
        });
        map.set("push-position", macroOperation => macroOperation.operation = this.enumerationOperation.pushPosition);
        map.set("pop-position", macroOperation => macroOperation.operation = this.enumerationOperation.popPosition);
        map.set("pause", macroOperation => macroOperation.operation = this.enumerationOperation.pause);
        map.set("return", macroOperation => macroOperation.operation = this.enumerationOperation.return);
        map.set("push-selection", macroOperation => {
            macroOperation.operation = this.enumerationOperation.pushText;
            macroOperation.target = this.enumerationTarget.selection;
        });
        map.set("push-word", macroOperation => {
            macroOperation.operation = this.enumerationOperation.pushText;
            macroOperation.target = this.enumerationTarget.word;
        });
        map.set("push-line", macroOperation => {
            macroOperation.operation = this.enumerationOperation.pushText;
            macroOperation.target = this.enumerationTarget.line;
        });
        map.set("push-trimmed-line", macroOperation => {
            macroOperation.operation = this.enumerationOperation.pushText;
            macroOperation.target = this.enumerationTarget.trimmedLine;
        });
        map.set("pop-text", macroOperation => macroOperation.operation = this.enumerationOperation.popText);      
        // case conversions:
        map.set("lower-case", macroOperation => macroOperation.caseConversion = this.enumerationCaseConversion.lower);
        map.set("upper-case", macroOperation => macroOperation.caseConversion = this.enumerationCaseConversion.upper);
        map.set("title-case", macroOperation => macroOperation.caseConversion = this.enumerationCaseConversion.title);
        map.set("camel-case", macroOperation => macroOperation.caseConversion = this.enumerationCaseConversion.camel);
        map.set("toggle-case", macroOperation => macroOperation.caseConversion = this.enumerationCaseConversion.toggle);
        map.set("member-syntax", macroOperation => macroOperation.caseConversion = this.enumerationCaseConversion.members);
        map.set("kebab-case-syntax", macroOperation => macroOperation.caseConversion = this.enumerationCaseConversion.kebab);
        map.set("snake-case-syntax", macroOperation => macroOperation.caseConversion = this.enumerationCaseConversion.snake);
        map.set("path-syntax", macroOperation => macroOperation.caseConversion = this.enumerationCaseConversion.path);
        map.set("split-by-case", macroOperation => macroOperation.caseConversion = this.enumerationCaseConversion.splitByCase);
        map.set("remove-punctuation", macroOperation => macroOperation.caseConversion = this.enumerationCaseConversion.removePunctuation);
        return map;
    })(); //operationMap

    const moveMap = (() => {
        const map = new Map();
        map.set("left", macroOperation => {
            macroOperation.target = this.enumerationTarget.character;
            macroOperation.move = this.enumerationMove.decrement;
        });
        map.set("right", macroOperation => {
            macroOperation.target = this.enumerationTarget.character;
            macroOperation.move = this.enumerationMove.increment;
        });
        map.set("up", macroOperation => {
            macroOperation.target = this.enumerationTarget.line;
            macroOperation.move = this.enumerationMove.decrement;
        });
        map.set("down", macroOperation => {
            macroOperation.target = this.enumerationTarget.line;
            macroOperation.move = this.enumerationMove.increment;
        });
        map.set("forward", macroOperation => {
            macroOperation.target = this.enumerationTarget.character;
            macroOperation.move = this.enumerationMove.forward;
        });
        map.set("backward", macroOperation => {
            macroOperation.target = this.enumerationTarget.character;
            macroOperation.move = this.enumerationMove.backward;
        });
        map.set("word-start", macroOperation => {
            macroOperation.target = this.enumerationTarget.word;
            macroOperation.move = this.enumerationMove.start;
        });
        map.set("word-end", macroOperation => {
            macroOperation.target = this.enumerationTarget.word;
            macroOperation.move = this.enumerationMove.end;
        });
        map.set("start-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.line;
            macroOperation.move = this.enumerationMove.start;
        });
        map.set("end-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.line;
            macroOperation.move = this.enumerationMove.end;
        });
        map.set("start-trimmed-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.trimmedLine;
            macroOperation.move = this.enumerationMove.start;
        });
        map.set("end-trimmed-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.trimmedLine;
            macroOperation.move = this.enumerationMove.end;
        });
        map.set("next-word", macroOperation => {
            macroOperation.target = this.enumerationTarget.word;
            macroOperation.move = this.enumerationMove.next;
        });
        map.set("previous-word", macroOperation => {
            macroOperation.target = this.enumerationTarget.word;
            macroOperation.move = this.enumerationMove.previous;
        });
        map.set("next-word", macroOperation => {
            macroOperation.target = this.enumerationTarget.word;
            macroOperation.move = this.enumerationMove.next;
        });
        map.set("next-empty-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.emptyLine;
            macroOperation.move = this.enumerationMove.next;
        });
        map.set("previous-empty-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.emptyLine;
            macroOperation.move = this.enumerationMove.previous;
        });
        map.set("match-in-line-forward", macroOperation => {
            macroOperation.target = this.enumerationTarget.forward;
            macroOperation.move = this.enumerationMove.matchInLine;
            return true; //indicates special parsing for matchInLine
        });
        map.set("match-in-line-backward", macroOperation => {
            macroOperation.target = this.enumerationTarget.backward;
            macroOperation.move = this.enumerationMove.matchInLine;
            return true; //indicates special parsing for matchInLine
        });
        return map;
    })(); //moveMap

    let operationsCore = [], errors = [];

    const filterOutCommentAndPushText = (line, index) => {
        line = line.trim();
        if (line.length < 1) return null;
        if (line.startsWith(definitionSet.parsing.textStart)) {
            const commentIndex = line.lastIndexOf(definitionSet.parsing.comment);
            const closingTextIndex = line.lastIndexOf(definitionSet.parsing.textEnd);
            if (commentIndex >=0 && commentIndex > closingTextIndex) { //cut out comment:
                line = line.substring(0, commentIndex - 1);
                line = line.trim();
            } //if comment
            if (line.endsWith(definitionSet.parsing.textEnd)) { //text
                const text = line.substring(1, line.length - 1);
                const macroOperation = new MacroOperation(this.enumerationOperation.text);
                macroOperation.value = text;
                macroOperation.index = index;
                operationsCore.push(macroOperation);
                return null;
            } //if text
        } //if
        const commentIndex = line.indexOf(definitionSet.parsing.comment);
        if (commentIndex >=0) { //cut out comment:
            line = line.substring(0, commentIndex);
            line = line.trim();
        } //if comment
        return line;
    }; //filterOutCommentAndPushText

    const clearSplit = text => {
        const split = text.split(definitionSet.parsing.blanskpace);
        const reSplit = [];
        for (const part of split) {
            const word = part.trim();
            if (word.length > 0) reSplit.push(word);
        } //loop
        return reSplit;
    }; //clearSplit

    const parseIntegerValue = text => {
        if (!text)
            return definitionSet.value.default;
        let value = parseInt(text.substring(0, definitionSet.value.maximumSize));
        if (isNaN(value))
            value = definitionSet.value.default;
        if (value < 1)
            value = definitionSet.value.default;
        return value;
    }; //parseIntegerValue

    const parseMatchInLine = (macroOperation, line, count) => {
        if (macroOperation.move != this.enumerationMove.matchInLine) return;
        const startText = line.indexOf(definitionSet.parsing.textStart);
        const endText = line.lastIndexOf(definitionSet.parsing.textEnd);
        if (startText < 0 || endText < 0) {
            errors.push({ count, line, unrecognized: line }); //SA???
            return true;
        } //if
        const text = line.substring(startText + 1, endText);
        line = line.substring(endText + 1).trim();
        const value = parseIntegerValue(line);
        macroOperation.value = { text, value };
        operationsCore.push(macroOperation);
        return true;
    }; //parseMatchInLine

    const parseLine = (line, count) => {
        line = filterOutCommentAndPushText(line, count);
        if (!line)
            return;
        const select = line.endsWith(definitionSet.parsing.select);
        if (select)
            line = line.substring(0, line.lastIndexOf(definitionSet.parsing.select)).trim();
        const words = clearSplit(line);
        if (!words) return;
        if (words.length < 1) return;
        const macroOperation = new MacroOperation();
        macroOperation.index = count;
        macroOperation.select = select;
        if (words.length > 0) {
            const setter = operationMap.get(words[0]);
            if (setter != null)
                setter(macroOperation);
            else
                errors.push({ count, line, unrecognized: words[0] });
        } //if
        if (words.length > 1) {
                const setter = moveMap.get(words[1]);
            if (setter != null) {
                if (setter(macroOperation)) {
                    if (parseMatchInLine(macroOperation, line, count));
                        return;
                } //if
            } else
                errors.push({ count, line, unrecognized: words[1] });
        } //if
        if (words.length > 2) // value or "select"
            macroOperation.value = parseIntegerValue(words[2]);
        if (macroOperation.value == null)
            macroOperation.value = definitionSet.value.default;
        operationsCore.push(macroOperation);
    }; //parseLine

    this.parse = text => {
        operationsCore = [];
        errors = [];
        const lines = text.split("\n");
        let count = 0;
        try {
        for (let line of lines)
            parseLine(line, ++count);
        } catch (ex) {
            console.log(ex);
        }
        this.operations = operationsCore;
        if (errors.length < 1)
            errors = null;
        return errors;
    }; //this.parse

}; //exports.RuleEngine
