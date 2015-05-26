"use strict";
var fs = require('fs');
var path = require('path');

var ANTI_SANITIZER = {};

var indicators = require('./indicators.js');
var control_chars = require('./control_chars.js');
var util = require('./util.js');
/***************************************************************************************************
*  parseFile
***************************************************************************************************/
var parseFile = function(file, options) {
	var data = fs.readFileSync(file, 'utf-8');

	// Remove UTF-8 BOM codes:
	data = data.trim();

	if ( options.javascript ) {
		return util.js.parse(data);
	}
	else {
		return JSON.parse(data);
	}
	return JSON.parse(data);
};
/***************************************************************************************************
*  processors
***************************************************************************************************/
var processors = {};

processors.primitive = function(super_value, class_value, path, root) {
	return util.sanitizeValue(class_value);
};
processors.dirrentType = function(super_value, class_value, path, root) {

	return util.sanitizeValue(class_value, true);
};
processors.object = function(super_value, class_value, path, root) {
	// If override is set to true return the class_value
	// If override is set to an array override those properties
	var override_action = class_value[indicators.OVERRIDE];
	if ( override_action === true ) {
		return util.sanitizeValue(class_value, true);
	}

	util.each(class_value, function(child_value, child_key) {
		// Prevent indicators from being mapped out to super_value
		if ( util.isIndicator(child_key) ) {
			return;
		}
		// If super doesnt have the value simply set it
		if ( !util.has(super_value, child_key) ) {
			super_value[child_key] = util.sanitizeValue(child_value, true);
		}
		// If override is an array and child_key is present set it on super_value
		else if ( override_action && override_action.indexOf(child_key) > -1 ) {
			super_value[child_key] = util.sanitizeValue(child_value, true);
		}
		// call function again and set return on super_value
		else {
			super_value[child_key] = processors.unknown(super_value[child_key], child_value, path + '/' + child_key, root);
		}
	});


	// If delete is an array and child_key is present set super_value to control_chars.DELETE.
	var delete_action = class_value[indicators.DELETE];
	if ( util.isArray(delete_action) ) {
		util.each(super_value, function(child_value, child_key) {

			if ( delete_action.indexOf(child_key) > -1 ) {
				super_value[child_key] = control_chars.DELETE;
			}
		});
	}

	return util.sanitizeValue(super_value);
};
processors.array = function(super_value, class_value, path, root) {
	// Store childs that have the @append, @prepend, @insert indicator
	var inserts = [];
	// Use prepend_index to store the current index that we are prepending at, eg with two
	//   or more prepends we to make sure that the first @prepend
	//   will be first item of the prepented items and not the last.
	var prepend_index = 0;
	// Use super_child_key to store array index relative to super_value.
	var super_child_key = 0;
	util.each(class_value, function(child_value, child_key) {
		// Fetch all @append and push them to the array after initial iteration.
		if ( util.has(child_value, indicators.APPEND) ) {
			inserts.push([-1, child_value]);
		}
		// Fetch all @prepend and unshift them to the array after initial iteration.
		else if ( util.has(child_value, indicators.PREPEND) ) {
			inserts.push([prepend_index, child_value]);
			prepend_index++;
		}
		// Fetch all @insert and splice them to the array after initial iteration.
		else if ( util.has(child_value, indicators.INSERT) ) {
			inserts.push([child_value[indicators.INSERT], child_value]);
		}
		else if ( util.has(child_value, indicators.MATCH) ) {
			// Send in parent path to avoid having to go up then down to match a specific item in an array
			// So you can use @match: "[name=john]" instead of @match: "../[name=john]"
			var matchInfo = util.pathQuery(child_value[indicators.MATCH], path, root);

			// If match is not found simply ignore and preserve super_value's child_value
			// Else determinate what to do, delete/override/etc
			if ( matchInfo != null ) {
				// Call recursive with match info's object and child_value
				// Remove @match to prevent recursive iteration
				delete child_value[indicators.MATCH];
				var merge_json = processors.unknown(matchInfo.object, child_value, matchInfo.path, root);
				// control_chars.DELETE indicates that we have to delete the original match
				if ( merge_json === control_chars.DELETE ) {
					util.deleteProperty(root, matchInfo.path);
				}
				// If the original child_value have @move delete the property
				//   from the original position and push it to inserts
				else if ( util.has(child_value, indicators.MOVE) ) {
					util.deleteProperty(root, matchInfo.path);
					inserts.push([child_value[indicators.MOVE], merge_json]);
				}
				else {
					util.setProperty(root, matchInfo.path, merge_json);
				}
			}
		}
		// If the child have @delete === true delete the child from the array
		else if ( child_value[indicators.DELETE] === true ) {
			super_value.splice(super_child_key, 1);
		}
		else {
			super_value[super_child_key] = processors.unknown(super_value[super_child_key], child_value, path + '/' + child_key, root);
			super_child_key++;
		}
	});
	util.each(inserts, function(cfg) {
		var index = cfg[0];
		var child_value = cfg[1];
		// splice treatment of nagative indexes is counter intuitive.
		//   eg index = -1 is the 2. to last position (not the last)
		//   eg index = -2 is the 3. to last position (not the 2. to last)
		//   Therefore we need to use push if index = -1
		//   and we need to index++ if index is less than -1
		if ( index == -1 ) {
			super_value.push(util.sanitizeValue(child_value, true));
		}
		else {
			if ( index < -1 ) {
				index++;
			}
			super_value.splice(index, 0, util.sanitizeValue(child_value, true));
		}
	});

	return util.sanitizeValue(super_value);
};
processors.unknown = function(super_value, class_value, path, root) {
	if ( path == null ) {
		path = '';
	}

	// Remap the class_value if it have the @value indicator
	if ( util.isObject(class_value) && util.has(class_value, indicators.VALUE) ) {
		class_value = class_value[indicators.VALUE];
	}

	// Force delete the super_value if class_value have the @delete indicator set to true
	//   This will allow deletion of primitives and arrays, with the following syntax:
	//     super = { arr: [ 1, 2, 3 ] }
	//     child = { arr: { "@delete": true } }
	if ( util.isObject(class_value) && util.has(class_value, indicators.DELETE) ) {
		// If delete is set to true return control_chars.DELETE, this will delete the property
		//    in the JSON.stringify
		// If delete is set to an array delete those properties
		if ( class_value[indicators.DELETE] === true ) {
			return control_chars.DELETE;
		}
	}

	var super_type = util.getType(super_value);
	var class_type = util.getType(class_value);

	/***********************************************************************************************
	*  Primitives
	***********************************************************************************************/
	if ( util.isPrimitive(super_type) || util.isPrimitive(class_type) ) {
		return processors.primitive(super_value, class_value, path, root);
	}
	/***********************************************************************************************
	*  Different types
	***********************************************************************************************/
	if ( super_type != class_type ) {
		return processors.dirrentType(super_value, class_value, path, root);
	}
	/***********************************************************************************************
	*  Objects
	***********************************************************************************************/
	if ( util.isObject(class_value) ) {
		return processors.object(super_value, class_value, path, root);
	}
	/***********************************************************************************************
	*  Arrays
	***********************************************************************************************/
	if ( util.isArray(class_value) ) {
		return processors.array(super_value, class_value, path, root);
	}

	throw new Error('Unsupported type.');
};
/***************************************************************************************************
*  merge
***************************************************************************************************/
var merge = function(super_json, child_json) {
	return processors.unknown(super_json, child_json, null, super_json);
}
/***************************************************************************************************
*  fromFile
***************************************************************************************************/
var fromFile = function(file, opts) {
	if ( util.isObject(file) || util.isArray(file) ) {
		return file;
	}

	var options = util.extend({
		asText: false, // true, false, 'pretty'
		javascript: false, // true, false
		scope: '', // directory to look for initial file
		variables: {
			// contains a key->value object with variables to @extends
		}
	}, opts);

	file = util.template(file, options.variables);
	/***********************************************************************************************
	*  Initialize
	***********************************************************************************************/
	var file_path;
	// If the file path is absolute use it
	// If not then prepend the current scope of the previous file.
	if ( path.resolve(file) === path.normalize(file) ) {
		file_path = path.normalize(file);
	}
	else {
		file_path = path.normalize(
			options.scope ? options.scope + '/' + file : file
		);
	}
	var class_json = parseFile(file_path, options);
	// Stores JSON objects of files that have to be merged together:
	// ["a", "b"]
	var file_list = util.isArray(class_json[indicators.EXTENDS]) ?
		class_json[indicators.EXTENDS] :
		class_json[indicators.EXTENDS] != null ?
			[ class_json[indicators.EXTENDS] ] :
			[];


	// Delete @extends from base_json to avoid infinitive recursion
	delete class_json[indicators.EXTENDS];
	// Push class_json to the path list:
	file_list.push(class_json);
	/***********************************************************************************************
	*  Merge file by file
	***********************************************************************************************/
	// default config for each file required:
	// set asText = false so we get an object returned
	// set scope = file's directory so there can be relative references
	var json_config = util.defaults({
		asText: false,
		scope: path.dirname(file_path),
		// _as is a hack so that we know its we are calling the function recursive
		_as: ANTI_SANITIZER
	}, options);

	// super_json is our output, start by containing first file in array
	var super_json = fromFile(file_list.shift(), json_config);

	// TODO: Figure out when to sanitize super_json hopefully we don't have to
	//   santize all returns. I'm not sure about this, and I'm not sure if we
	//   can even sanitize super_json when we return it.
	//   Is super_json used by anyone recursively?

	while ( file_list.length ) {
		var json = fromFile(file_list.shift(), json_config);

		merge(super_json, json);
	}

	// If this file is called from the outside eg json_merger.from...
	//   File('file_which_doesnt_extends_another_file.json')
	//   we need to sanitize the file and remove all indicators
	if ( options._as != ANTI_SANITIZER ) {
		super_json = util.sanitizeValue(super_json, true, true);
	}

	/***********************************************************************************************
	*  Return super_json
	***********************************************************************************************/
	if ( options.asText == 'pretty' && options.javascript ) {
		return util.js.stringify(super_json, '\t');
	}
	if ( options.asText && options.javascript ) {
		return util.js.stringify(super_json);
	}
	if ( options.asText == 'pretty' ) {
		return JSON.stringify(super_json, null, '\t');
	}
	if ( options.asText ) {
		return JSON.stringify(super_json);
	}
	return super_json;
};
/***************************************************************************************************
*  exports
***************************************************************************************************/
module.exports = {
	fromFile: fromFile,
	merge: merge
};
