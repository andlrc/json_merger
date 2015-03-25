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
	// Remap value og the object to whats in @value (usefull for appending / prepending to arrays)
	VALUE: '@value',
	OVERRIDE: '@override',
	COMMENT: '@comment',
	DELETE: '@delete',
	MATCH: '@match'
};

indicators.ALL = Object.keys(indicators).map(function(key) {
	return indicators[key];
});

module.exports = indicators;
