"use strict";
var indicators = {
	// root indicators
	EXTENDS: '@extends',
	// used for array, append to end, prepend to beginning, or insert at index:
	APPEND: '@append',
	PREPEND: '@prepend',
	INSERT: '@insert',
	// @move is the same as @insert but used with @match
	MOVE: '@move',
	// Used with match so that we can match primitives:
	//   To match the c value in this array (index 2): ["a", "b", "c"] use @match: "[@value=c]"
	ATTR_VALUE: '@value',
	// Remap value og the object to whats in @value (usefull for appending / prepending to arrays)
	VALUE: '@value',
	OVERRIDE: '@override',
	COMMENT: '@comment',
	ID: '@id',
	DELETE: '@delete',
	MATCH: '@match'
};

indicators.ALL = Object.keys(indicators).map(function(key) {
	return indicators[key];
});

indicators.ALL_EXCL_ID = indicators.ALL.filter(function(indicator) {
	return indicator != indicators.ID;
});

module.exports = indicators;
