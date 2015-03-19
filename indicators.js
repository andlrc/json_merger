"use strict";
var indicators = {
	EXTENDS: '@extends',
	OVERRIDE: '@override',
	COMMENT: '@comment',
	DELETE: '@delete',
	MATCH: '@match',
	// Move us the same as @insert but used with match
	MOVE: '@move',
	// used for array, append to end, prepend to beginning, or insert at index:
	APPEND: '@append',
	PREPEND: '@prepend',
	INSERT: '@insert'
};

indicators.ALL = Object.keys(indicators).map(function(key) {
	return indicators[key];
});

module.exports = indicators;
