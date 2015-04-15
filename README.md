[![json_merger downloads/month](https://img.shields.io/npm/dm/json_merger.svg)](https://www.npmjs.com/package/json_merger)
[![json_merger version](https://img.shields.io/npm/v/json_merger.svg)](https://www.npmjs.com/package/json_merger)
[![json_merger license](https://img.shields.io/npm/l/json_merger.svg)](https://www.npmjs.com/package/json_merger)

## Table of Contents:

* [`.fromFile('file.json')`](#fromfilefilejson)
  * [config](#config)
    * [asText](#configastext)
    * [javascript](#configjavascript)
    * [scope](#configscope)
    * [variables](#configvariables)
  * [`@extends`](#extends)
* [Indicators](#indicators)
  * [`@extends`](#extends)
  * [`@override`](#override)
  * [`@append`, `@prepend`, `@insert`](#append-prepend-insert)
  * [`@match`](#match)
  * [`@move`](#move)
  * [`@value`](#value)
  * [`@comment`](#comment)
  * [`@id`](#id)
* [`.merge(objA, objB)`](#mergeobja-objb)
* [Command line interface `json_merger`](#command-line-interface-json_merger)
* [Expiremental usage](#expiremental-usage)
* [Root indicators](#root-indicators)
* [License](#license)

Apply indicators such as [`@insert`](#append-prepend-insert), [`@match`](#match) and [`@override`](#override) to tell the processor how to merge the files.

## `.fromFile('file.json')`

    var json_merger = require('json_merger');
    var result = json_merger = json_merger.fromFile('fileA.json');

**fileA.json:**

```json
{
	"@extends": "fileB.json",
	"prop1": {
		"@override": true,
		"prop_a": "this will override fileB.json's property prop1"
	},
	"prop2": {
		"prop_a": "some value"
	}
}
```

**fileB.json:**

```json
{
	"prop1": {
		"prop_b": "never gonna be seen"
	},
	"prop2": {
		"prop_b": "some other value"
	}
}
```

Result:

```json
{
	"prop1": {
		"prop_a": "this will override fileB.json's property prop1"
	},
	"prop2": {
		"prop_a": "some value",
		"prop_b": "some other value"
	}
}
```

### config

```javascript
{
    asText: false, // true, false, 'pretty'
    javascript: false, // true, false
    scope: '', // directory to look for initial file
    variables: {
        // contains a key->value object with variables to @extends
    }
}
```

#### config.asText

default: `false` (in command line interface it will default to true)

Values are `true`, `false`, `pretty` where pretty will indent the JSON with `\t` for each block.

#### config.javascript

*Expiremental*

default: `false`

Perserve JavaScript functions, regexp, etc see [Expiremental usage](#expiremental-usage)

#### config.scope

default: [`process.cwd()`](https://nodejs.org/api/process.html#process_process_cwd)


The initial directory which the inputFile is relative too, will be overridden for each [`@extends`](#extends) file and is set to dirname of current inputFile.

#### config.variables

default: `{}`

Variables is used in [`@extends`](#extends) like the following:

```javascript
json_merger.fromFile('fileA.json', {
    "project_root": "/var/www/project123"
});
```

**fileA.json**

```json
{
    "@extends": ["${project_root}/fileB.json"]
}
```

--------

## Indicators:

### `@extends`

An array / string indicating which files a given object extends, this is a [root indicator](#root-indicators)

```json
{
    "@extends": ["main_file.json", "project_file.js", "mixin_file.json"]
}
```


### `@override`

An array or `true` indicating that the given property will be overridden. When used with `true` the whole property will be overridden. When used with an array the listed properties will be overridden:

**Usuage of `true`**

```json
{
	"@extends": ["b.json"],
	"a": {
		"@override": true,
		"prop_1": {"a":1},
		"prop_2": {"a":2}
	}
}
```

**b.json**

```json
{
	"a": {
		"prop_1": {"b":1},
		"prop_2": {"b":2},
		"prop_3": {"b":3},
		"prop_4": {"b":4}
	}
}
```

**Result**

```json
{
	"a": {
		"prop_1": {"a":1},
		"prop_2": {"a":2}
	}
}
```

**Usuage of array**

```json
{
	"@extends": ["b.json"],
	"a": {
		"@override": ["prop_1"],
		"prop_1": {"a":1},
		"prop_2": {"a":2}
	}
}
```

**b.json**

```json
{
	"a": {
		"prop_1": {"b":1},
		"prop_2": {"b":2},
		"prop_3": {"b":3},
		"prop_4": {"b":4}
	}
}
```

**Result**

```json
{
	"a": {
		"prop_1": {"a":1},
		"prop_2": {"a":2, "b":2},
		"prop_3": {"b":3},
		"prop_4": {"b":4}
	}
}
```

### `@append`, `@prepend`, `@insert`

When working with array the default behaviour will be to merge on indexes, eg first item in the arrays will be merged together etc.

* `@append: true` is alias for `@insert: -1`
* `@prepend: true` is alias for `@insert: 0`

Using `@insert`:

```json
{
	"@extends": ["b.json"],
	"a": [
		{
			"@insert": 1,
			"a": 1
		}
	]
}
```

**b.json**

```json
{
	"a": [
		{
			"b": 1
		},
		{
			"b": 2
		},
		{
			"b": 3
		}
	]
}
```

**Result**

```json
{
	"a": [
		{
			"b": 1
		},
		{
			"a": 1
		},
		{
			"b": 2
		},
		{
			"b": 3
		}
	]
}
```

### `@match`

Match can be used to match a given item in an array; Supported syntax:

    [prop1=val1][prop2='val2']

You can ether use prop1, prop2 for matching regular properties `@value` which will match the value of primitives in the array:

Quoting is optional but required if you want strict comparison, eg `[prop='2']` will match `{"prop": "2"}` and not `{"prop": 2}`

**Usuage**

```json
{
	"@extends": ["b.json"],
	"columns": [
		{
			"@match": "[name=token]",
			"type": "float"
		}
	]
}
```

**b.json**

```json
{
	"columns": [
		{
			"name": "firstname",
			"type": "varchar(64)"
		},
		{
			"name": "lastname",
			"type": "varchar(64)"
		},
		{
			"name": "token",
			"type": "integer"
		}
	]
}
```

**Result**

```json
{
	"columns": [
		{
			"name": "firstname",
			"type": "varchar(64)"
		},
		{
			"name": "lastname",
			"type": "varchar(64)"
		},
		{
			"name": "token",
			"type": "float"
		}
	]
}
```

**Advanced usage**

```json
{
    "@extends": ["b.json"],
    "outer_array": [
        {
            "@match": "[key=value]/inner_array/[inner_key=inner_value]",
            "type": "float"
        }
    ]
}
```

**b.json**

```json
{
    "outer_array": [
        {
            "key": "value",
            "inner_array": [
                {
                    "inner_key": "inner_value"
                }
            ]
        }
    ]
}
```

**Result**

```json
{
    "outer_array": [
        {
            "key": "value",
            "inner_array": [
                {
                    "inner_key": "inner_value",
                    "type": "float"
                }
            ]
        }
    ]
}
```


**Advanced Usuage 2 (`@value`)**

```json
{
	"@extends": ["b.json"],
	"seq": [
		{
			"@match": "[@value=b]",
			"@delete": true
		}
	]
}
```

**b.json**

```json
{
	"seq": [
		"a",
		"b",
		"c",
		"d"
	]
}
```

**Result**

```json
{
	"columns": [
		"a",
		"c",
		"d"
	]
}
```

### `@move`

This indicator is the same as [`@insert`](#append-prepend-insert) but is used together with [`@match`](#match).

### `@value`

Used when merging arrays containing primitives or other arrays

```json
{
    "@extends": ["fileB.json"],
	"sequence": [
		{
			"@insert": 1,
			"@value": "insertedField"
		}
	]
}
```

**fileB.json**

```json
{
	"sequence": [
		"fieldA",
		"fieldB",
		"fieldC"
	]
}
```

**Output**

```json
{
	"sequence": [
		"fieldA",
		"insertedField",
		"fieldB",
		"fieldC"
	]
}
```

### `@comment`

These will be removed in the merging process and is intented to be used for internal comments about overrides etc.

```json
{
    "@comment": "I did this because...."
}
```

### `@id`

This can be matches in [`@match`](#match) using the following syntax:

```json
{
	"@extends": ["b.json"],
    "array": [
		{ "a": 2, "@match": "[@id=my_id]" }
    ]
}
```

**b.json**

```json
{
    "array": [
		{ "a": 1 },
		{ "a": 2, "@id": "my_id" }
    ]
}
```

--------

## `.merge(objA, objB)`

You can use json_merger without having to use JSON stored in files, you can use it directly with JavaScript objects:

```javascript
var json_merger = require('json_merger');

var a = {
    a: {
        "@override": true,
        "my_value": 1234
    }
};
var b = {
    a: {
        "my_b_value": 1234
    }
}

var result = json_merger.merge(a, b);

console.log(result.a.my_value); // 1234
console.log(result.a.my_b_value); // undefined
```

--------

## Command line interface `json_merger`

You can use json_merger as a command line tool:

    usage:
      json_merger inputFile [...options]

    options:
      --help, -h                    Show this page
      --pretty, -p                  Prettify the output json
      --javascript, -j              Perserve JavaScript functions, regexp, etc
      --variables, -v               Send key=value list of variables
                                      Usage: -v key1=value1 key2=value2


Usage:

```sh
json_merger input.json > out.json
json_merger input.json --pretty > out.json
json_merger input.json --javascript > out.json
json_merger input.json -p -j -v "root=/var/www/" > out.json
```

Make sure that add json_merger to the `$PATH` variable:

```sh
npm install json_merger
```

**~/.bashrc ( *~/.bash_profile* on OSX )**

```sh
export PATH=/path/to/my/json_merger/bin/:$PATH
```

## Expiremental usage:

Working with JavaScript code in JSON *Use at own risk :-)*

```javascript
var json_merger = require('json_merger');

var output = json_merger.fromFile('file.jsonx', {
    asText: 'pretty',
    javascript: true
});
```

**file.jsonx**

```javascript
{
    "@extends": ["fileB.jsonx"],
    "my_function": function(a, b) { return doStuff(a, b) },
    "obj": {
        "a": (function(a, b) { /* code here */ })(1, 2)
    }
}
```

**fileB.jsonx**

```javascript
{
    "@extends": ["fileB.jsonx"],
    "obj": {
        "b": (function(a, b) { /* another code here */ })(1, 2)
    }
}
```

Result:

```javascript
{
    "my_function": function(a, b) { return doStuff(a, b) },
    "obj": {
        "a": (function(a, b) { /* code here */ })(1, 2),
        "b": (function(a, b) { /* another code here */ })(1, 2)
    }
}
```

## Root indicators ##

Root indicators is properties that are only supported on the outer most level of the JSON tree.

Current supported root indicators:

* [`@extends`](#extends)

## License: ##

The MIT License (MIT)

Copyright (c) 2015 Andreas Louv

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

```brainfuck
+++++ +++++ +[>+++++ +++++<-]>----.+++++++++.----.-.---------------.++++++++++++++.--------.+++++++++++++.-----------.--.+++++++++++++.
```
