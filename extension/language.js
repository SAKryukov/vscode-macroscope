/*

Copyright (c) Sergey A Kryukov
https://github.com/SAKryukov/vscode-yacc
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
        move: 0, text: 0, copy: 0, paste: 0, delete: 0, find: 0, deselect: 0,
    }; //enumerationOperation
    this.enumerationTarget = {
        character: 0, line: 0, trimmedLine: 0, emptyLine: 0, word: 0, 
    };
    this.enumerationMoveLocation = {
        increment: 0, decrement: 0, start: 0, end: 0, next: 0, previous: 0,
    };
    utility.preprocessEnumeration(this.enumerationOperation);
    utility.preprocessEnumeration(this.enumerationTarget);
    utility.preprocessEnumeration(this.enumerationMoveLocation);

    const MacroOperation = function(operation, target, move, value, select, index) {
        this.operation = operation; //this.enumerationOperation
        this.target = target; //this.enumerationTarget
        this.move = move; //this.enumerationMoveLocation
        this.value = value; //number of steps or text to insert/replace
        this.select = select;
        this.index = index;
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
        map.set("delete", macroOperation => macroOperation.operation = this.enumerationOperation.delete);
        map.set("find-next", macroOperation => {
            macroOperation.operation = this.enumerationOperation.find;
            macroOperation.move = this.enumerationMoveLocation.next;
        });
        map.set("find-previous", macroOperation => {
            macroOperation.operation = this.enumerationOperation.find;
            macroOperation.move = this.enumerationMoveLocation.previous;
        });
        map.set("deselect-start", macroOperation => {
            macroOperation.operation = this.enumerationOperation.deselect;
            macroOperation.move = this.enumerationMoveLocation.start;
        });
        map.set("deselect-end", macroOperation => {
            macroOperation.operation = this.enumerationOperation.deselect;
            macroOperation.move = this.enumerationMoveLocation.end;
        });
        return map;
    })(); //operationMap

    const moveMap = (() => {
        const map = new Map();
        map.set("left", macroOperation => {
            macroOperation.target = this.enumerationTarget.character;
            macroOperation.move = this.enumerationMoveLocation.decrement;
        });
        map.set("right", macroOperation => {
            macroOperation.target = this.enumerationTarget.character;
            macroOperation.move = this.enumerationMoveLocation.increment;
        });
        map.set("up", macroOperation => {
            macroOperation.target = this.enumerationTarget.line;
            macroOperation.move = this.enumerationMoveLocation.decrement;
        });
        map.set("down", macroOperation => {
            macroOperation.target = this.enumerationTarget.line;
            macroOperation.move = this.enumerationMoveLocation.increment;
        });
        map.set("word-start", macroOperation => {
            macroOperation.target = this.enumerationTarget.word;
            macroOperation.move = this.enumerationMoveLocation.start;
        });
        map.set("word-end", macroOperation => {
            macroOperation.target = this.enumerationTarget.word;
            macroOperation.move = this.enumerationMoveLocation.end;
        });
        map.set("start-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.line;
            macroOperation.move = this.enumerationMoveLocation.start;
        });
        map.set("end-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.line;
            macroOperation.move = this.enumerationMoveLocation.end;
        });
        map.set("start-trimmed-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.trimmedLine;
            macroOperation.move = this.enumerationMoveLocation.start;
        });
        map.set("end-trimmed-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.trimmedLine;
            macroOperation.move = this.enumerationMoveLocation.end;
        });
        map.set("next-word", macroOperation => {
            macroOperation.target = this.enumerationTarget.word;
            macroOperation.move = this.enumerationMoveLocation.next;
        });
        map.set("previous-word", macroOperation => {
            macroOperation.target = this.enumerationTarget.word;
            macroOperation.move = this.enumerationMoveLocation.previous;
        });
        map.set("next-word", macroOperation => {
            macroOperation.target = this.enumerationTarget.word;
            macroOperation.move = this.enumerationMoveLocation.next;
        });
        map.set("next-empty-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.emptyLine;
            macroOperation.move = this.enumerationMoveLocation.next;
        });
        map.set("previous-empty-line", macroOperation => {
            macroOperation.target = this.enumerationTarget.emptyLine;
            macroOperation.move = this.enumerationMoveLocation.previous;
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

    const parseLine = (line, count) => {
        line = filterOutCommentAndPushText(line, count);
        if (!line)
            return;
        let select = line.includes("select");
        const words = line.split(definitionSet.parsing.blankpace);
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
            if (setter != null)
                setter(macroOperation);
            else
                errors.push({ count, line, unrecognized: words[1] });
        } //if
        if (words.length > 2) { // value or "select"
            macroOperation.value = parseInt(words[2].substring(0, definitionSet.value.maximumSize));
            if (isNaN(macroOperation.value))
                macroOperation.value = definitionSet.value.default;
            if (macroOperation.value < 1)
                macroOperation.value = definitionSet.value.default;
        } //if
        if (macroOperation.value == null)
            macroOperation.value = definitionSet.value.default;
        operationsCore.push(macroOperation);    
    }; //parseLine

    this.parse = text => {
        operationsCore = [];
        errors = [];
        const lines = text.split("\n");
        let count = 0;
        for (let line of lines)
            parseLine(line, ++count);
        this.operations = operationsCore;
        if (errors.length < 1)
            errors = null;
        return errors;
    }; //this.parse

}; //exports.RuleEngine
