"use strict";

// Initial source code:
// https://github.com/douglascrockford/JSON-js/blob/master/json_parse.js

var MAX_SIZE = 2 * 1024 * 1024;

var control_chars = require('./control_chars.js');

var at;     // The index of the current character
var ch;     // The current character
var text;
var escapee = {
    '"': '"',
    '\\': '\\',
    '/': '/',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t'
};
var error = function (m) {
    // Call error when something is wrong.
    var msg = m + ' at ' + at+ ':'+text.length+': ';
    var s = Math.max(at-10, 0);
    var e = Math.min(at+30, text.length);
    var code = text.slice(s, at-1) + ' >>'+ ch +'<< ' + text.slice(at, e);

    msg += code;

    throw new Error(msg);
};
var next = function (c) {
    // If a c parameter is provided, verify that it matches the current character.

    if (c && c !== ch) {
        error("Expected '" + c + "' instead of '" + ch + "'");
    }

    // Get the next character. When there are no more characters,
    // return the empty string.

    ch = text.charAt(at);
    at += 1;
    return ch;
};
var number = function () {
    // Parse a number value.

    var number,
        string = '';

    if (ch === '-') {
        string = '-';
        next('-');
    }
    while (ch >= '0' && ch <= '9') {
        string += ch;
        next();
    }
    if (ch === '.') {
        string += '.';
        while (next() && ch >= '0' && ch <= '9') {
            string += ch;
        }
    }
    if (ch === 'e' || ch === 'E') {
        string += ch;
        next();
        if (ch === '-' || ch === '+') {
            string += ch;
            next();
        }
        while (ch >= '0' && ch <= '9') {
            string += ch;
            next();
        }
    }
    number = +string;
    if (!isFinite(number)) {
        error("Bad number");
    } else {
        return number;
    }
};
var string = function () {
    // Parse a string value.

    var hex,
        i,
        string = '',
        uffff;

    // When parsing for string values, we must look for " and \ characters.

    if (ch === '"') {
        while (next()) {
            if (ch === '"') {
                next();
                return string;
            }
            if (ch === '\\') {
                next();
                if (ch === 'u') {
                    uffff = 0;
                    for (i = 0; i < 4; i += 1) {
                        hex = parseInt(next(), 16);
                        if (!isFinite(hex)) {
                            break;
                        }
                        uffff = uffff * 16 + hex;
                    }
                    string += String.fromCharCode(uffff);
                } else if (typeof escapee[ch] === 'string') {
                    string += escapee[ch];
                } else {
                    break;
                }
            } else {
                string += ch;
            }
        }
    }
    error("Bad string");
};
var white = function () {
    // Skip whitespace.

    while (ch && ch <= ' ') {
        next();
    }
};
var maybe = function(str) {
    var i = 0;
    while ( i < str.length ) {
        if ( text.charAt(at+i-1) != str.charAt(i) ) {
            return false;
        }
        i++;
    }

    ch = text.charAt(at+i-1);
    at += i;

    return true;
};
var literal = function () {

    white();

    if ( maybe('true') ) {
        return true;
    }
    if ( maybe('false') ) {
        return false;
    }
    if ( maybe('null') ) {
        return null;
    }

    var ret = control_chars.LITERAL;

    var brackets = [
        0, // { & }
        0, // [ & ]
        0  // ( & )
    ];

    var size = 0;

    outer:
        while ( true && size <= MAX_SIZE ) {
            size++;
            switch ( ch ) {
            case '{':
                brackets[0]++;
                break;
            case '}':
                brackets[0]--;
                if ( brackets[0] < 0 ) {
                    break outer;
                }
                break;
            case '[':
                brackets[1]++;
                break;
            case ']':
                brackets[1]--;
                if ( brackets[1] < 0 ) {
                    break outer;
                }
                break;
            case '(':
                brackets[2]++;
                break;
            case ')':
                brackets[2]--;
                if ( brackets[2] < 0 ) {
                    error("Didn't expect )");
                }
                break;
            default: break
            }

            ret += ch;

            ch = text.charAt(at);
            at++;

            if ( ch == null ) {
                error("Syntax error");
                break;
            }

            if ( ch == ',' ) {
                if ( brackets[0] == 0 && brackets[1] == 0 && brackets[2] == 0 ) {
                    break;
                }
            }
        }

    if ( size > MAX_SIZE ) {
        error("Max size exceeded, while parsing a literal.");
    }

    ret += control_chars.LITERAL;

    return ret;
};
var array = function () {
    // Parse an array value.

    var array = [];

    if (ch === '[') {
        next('[');
        white();
        if (ch === ']') {
            next(']');
            return array;   // empty array
        }
        while (ch) {
            array.push(value());
            white();
            if (ch === ']') {
                next(']');
                return array;
            }
            next(',');
            white();
        }
    }
    error("Bad array");
};
var object = function () {
    // Parse an object value.

    var key,
        object = {};

    if (ch === '{') {
        next('{');
        white();
        if (ch === '}') {
            next('}');
            return object;   // empty object
        }
        while (ch) {
            key = string();
            white();
            next(':');
            if (Object.hasOwnProperty.call(object, key)) {
                error('Duplicate key "' + key + '"');
            }
            object[key] = value();
            white();
            if (ch === '}') {
                next('}');
                return object;
            }
            next(',');
            white();
        }
    }
    error("Bad object");
};
var value = function (initial) {

    // Parse a JSON value. It could be an object, an array, a string, a number, or a literal.
    white();
    if ( initial ) {
        switch (ch) {
        case '{':
            return object();
        case '[':
            return array();
        default:
            next('{ or [');
            return null;
        }
    }
    switch (ch) {
    case '{':
        return object();
    case '[':
        return array();
    case '"':
        return string();
    case '-':
        return number();
    default:
        return ch >= '0' && ch <= '9'
        ? number()
        : literal();
    }
};

var parse = function(source, reviver) {
    var result;

    text = source;
    at = 0;
    ch = ' ';
    result = value(true);
    white();
    if (ch) {
        error("Syntax error");
    }

    // If there is a reviver function, we recursively walk the new structure,
    // passing each name/value pair to the reviver function for possible
    // transformation, starting with a temporary root object that holds the result
    // in an empty key. If there is not a reviver function, we simply return the
    // result.

    return typeof reviver === 'function'
    ? (function walk(holder, key) {
        var k, v, value = holder[key];
        if (value && typeof value === 'object') {
            for (k in value) {
                if (Object.prototype.hasOwnProperty.call(value, k)) {
                    v = walk(value, k);
                    if (v !== undefined) {
                        value[k] = v;
                    } else {
                        delete value[k];
                    }
                }
            }
        }
        return reviver.call(holder, key, value);
    }({'': result}, ''))
    : result;
};
var stringify = function(obj, indentation) {

    var ret = JSON.stringify(obj, null, indentation);

    var start = -1;
    var end = -1;
    while ( (start=ret.indexOf(control_chars.LITERAL)) > -1 ) {
        end = ret.indexOf(control_chars.LITERAL, start + 1) + control_chars.LITERAL.length;

        var func = ret.slice(start + control_chars.LITERAL.length, end - control_chars.LITERAL.length);

        ret = ret.slice(0, start-1) + func.replace(/(\\)./g, function(all, char, index) {
            return JSON.parse('"\\'+ func.charAt(index+1) +'"');
        }) + ret.slice(end+1);
    }

    return ret;
}

module.exports = {
    parse: parse,
    stringify: stringify
};
