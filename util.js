"use strict";

var indicators = require('./indicators.js');
var control_chars = require('./control_chars.js');
var util_js = require('./util_js.js');

var _toString = Object.prototype.toString;
var _hasOwn = Object.prototype.hasOwnProperty;

var r_tpl = /\$(?:([a-zA-Z0-9_\.\-]+)|\{([a-zA-Z0-9_\.\-]+)\})/g;

var util = {
	js: util_js,
	template: function(str, data) {

		return str.replace(r_tpl, function(x, key, key2) {

			return data[key] || data[key2] || '';
		});
	},
	extend: function(a, b) {
		for ( var prop in b ) {
			if ( _hasOwn.call(b, prop) ) {
				a[prop] = b[prop];
			}
		}

		return a;
	},
	defaults: function(a, b) {
		for ( var prop in b ) {
			if ( a[prop] == null && _hasOwn.call(b, prop) ) {
				a[prop] = b[prop];
			}
		}

		return a;
	},
	getType: function(v) {
		return _toString.call(v).slice(8,-1);
	},
	isPrimitive: function(type) {
		return type !== 'Array' && type !== 'Object';
	},
	isIndicator: function(key) {
		return indicators.ALL.indexOf(key) > -1;
	},
	has: function(obj, key) {
		return _hasOwn.call(obj, key);
	},
	sanitizeValue: function(obj, deep, delete_id) {
		if ( util.isObject(obj) ) {
			if ( util.has(obj, indicators.VALUE) ) {
				return util.sanitizeValue(obj[indicators.VALUE]);
			}
			util.each(delete_id ? indicators.ALL : indicators.ALL_EXCL_ID, function(indicator) {
				delete obj[indicator];
			});
		}
		if ( deep && (util.isObject(obj) || util.isArray(obj)) ) {
			util.each(obj, function(child_value, child_key) {
				obj[child_key] = util.sanitizeValue(child_value, deep, delete_id);
			});
		}

		return obj;
	},
	parseValue: function(v) {
		var char0 = v.charAt(0);
		var char1 = v.charAt(v.length-1);
		if ( char0 == char1 && (char0 == '\'' || char0 == '"') ) {
			return v.slice(1, -1);
		}
		else {
			try {
				return JSON.parse(v);
			}
			catch (e) {
				return v;
			}
		}
	},
	deleteProperty: function(root, root_path) {
		var paths = root_path.slice(1).split('/');

		var child_key = paths.pop();

		var obj = root;

		while ( paths.length && obj ) {
			var path = paths.shift();

			obj = obj[path];
		}

		if ( util.isArray(obj) ) {
			obj.splice(child_key, 1);
			return true;
		}
		else if ( util.isObject(obj) ) {
			delete obj[child_key];
			return true;
		}
		else {
			return false;
		}
	},
	setProperty: function(root, root_path, value) {
		var paths = root_path.slice(1).split('/');

		var child_key = paths.pop();

		var obj = root;

		while ( paths.length && obj ) {
			var path = paths.shift();

			obj = obj[path];
		}

		if ( util.isArray(obj) || util.isObject(obj) ) {
			obj[child_key] = value;
			return true;
		}
		else {
			return false;
		}
	},
	processMatchKey: function(key, path) {
		// key = [name='qwerty'][a=2]
		// output = [{type: 'attr', attrs: {name: 'query', a: 2}}]

		var r_xpath = /(?:\/|^)([^\/]+)/;
		var r_attr = /\[(.*?)=(.*?)\]/;

		var a_match = null;
		var a_attr_match = null;

		var matches = [];
		// If we are relative we need to append path to the key:
		var is_relative = key.charAt(0) != '/';

		if ( is_relative ) {
			key = path+'/'+key;
		}
		while ( (a_match=key.match(r_xpath)) ) {
			// remove match from string to prevent infinity recursion
			key = key.slice(a_match[0].length);

			var match = a_match[1];

			// if dealing with attrs parse them: ([name='abc'][id=123])
			if ( r_attr.test(match) ) {
				var o_attr = {
					type: 'attr',
					attrs: {}
				};
				while ( (a_attr_match=match.match(r_attr)) ) {
					// remove match from string to prevent infinity recursion
					match = match.slice(a_attr_match[0].length);

					o_attr.attrs[a_attr_match[1]] = util.parseValue(a_attr_match[2]);
				}

				matches.push(o_attr);
			}
			// Go one up the "ladder":
			else if ( match == '..' ) {
				matches.splice(matches.length - 1, 1);
			}
			// Omit self reference:
			else if ( match != '.' ) {
				matches.push({
					type: 'path',
					path: match
				});
			}
		}

		return matches;
	},
	pathQuery: function(matchKey, root_path, root) {
		var paths = util.processMatchKey(matchKey, root_path);

		var obj = root;

		// Contain empty element as first element to get leading slash
		var _abs_path = [''];

		while ( paths.length ) {

			if ( obj == null ) {
				return null;
			}

			var path = paths.shift();

			if ( path.type == 'path' ) {
				obj = obj[path.path];
				_abs_path.push(path.path);
			}
			else if ( path.type == 'attr' ) {
				// Run through the array and find the match
				if ( util.isArray(obj) ) {
					var match = true;
					util.each(obj, function(obj_value, obj_key) {

						match = true;

						util.each(path.attrs, function(attr_value, attr_key) {
							// @value indicator is used to match the value of
							//   the object and not match attributes:
							if ( attr_key == indicators.ATTR_VALUE ) {
								if ( obj_value !== attr_value ) {
									match = false;
								}
							}
							// Default match key=value
							else {
								if ( obj_value[attr_key] !== attr_value ) {
									match = false;
								}
							}
						});

						if ( match ) {
							obj = obj[obj_key];
							_abs_path.push(obj_key);
							return false;
						}
					});

					if ( match === false ) {
						return null;
					}
				}
				else {
					var match = true;
					util.each(path.attrs, function(attr_value, attr_key) {
						if ( obj[attr_key] !== attr_value ) {
							match = false;
							return false;
						}
					});
					if ( match === false ) {
						return null;
					}
				}
			}
			else {
				throw new Error('pathQuery: Type not supported!');
			}
		}

		return {
			object: obj,
			path: _abs_path.join('/')
		};
	},
	each: function(obj, fn) {
		// array
		if ( util.isArray(obj) ) {
			for ( var i = 0; i < obj.length; i++ ) {
				if ( fn.call(obj, obj[i], i, obj) === false ) break;
			}
		}
		else {
			for ( var prop in obj ) {
				if ( _hasOwn.call(obj, prop) ) {
					if ( fn.call(obj, obj[prop], prop, obj) === false ) break;
				}
			}
		}
	}
};

['Object', 'Array', 'Null', 'String', 'Number'].forEach(function(type) {
	util['is' + type] = function(v) {
		return util.getType(v) == type;
	}
});

module.exports = util;
