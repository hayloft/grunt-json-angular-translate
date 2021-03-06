/*
 * grunt-json-angular-translate
 *
 *
 * Copyright (c) 2014 Shahar Talmi
 * Licensed under the MIT license.
 */

'use strict';

var multiline = require('multiline');
var jbfunc = 'js_beautify';
var jb = require('js-beautify')[jbfunc];
var toSingleQuotes = require('to-single-quotes-shahata');
var extend = require('util')._extend;

function merge(base, add) {
  var key = Object.keys(add)[0];
  if (typeof(add[key]) === 'object' && base[key]) {
    merge(base[key], add[key]);
  } else {
    base[key] = add[key];
  }
  return base;
}

function unflatten(json) {
  return Object.keys(json).reduceRight(function(prev, key) {
    return merge(prev, key.split('.').reduceRight(function (prev, curr) {
      var obj = {};
      obj[curr] = prev;
      return obj;
    }, json[key]));
  }, {});
}

function reverse(json) {
  return Object.keys(json).reduceRight(function (newObject, value) {
    newObject[value] = json[value];
    return newObject;
  }, {});
}

function deepmerge(target, src) {
  var array = Array.isArray(src);
  var dst = array && [] || {};

  if (array) {
    target = target || [];
    dst = dst.concat(target);
    src.forEach(function(e, i) {
      if (typeof dst[i] === 'undefined') {
        dst[i] = e;
      } else if (typeof e === 'object') {
        dst[i] = deepmerge(target[i], e);
      } else {
        if (target.indexOf(e) === -1) {
          dst.push(e);
        }
      }
    });
  } else {
    if (target && typeof target === 'object') {
      Object.keys(target).forEach(function (key) {
        dst[key] = target[key];
      })
    }
    Object.keys(src).forEach(function (key) {
      if (typeof src[key] !== 'object' || !src[key]) {
        dst[key] = src[key];
      }
      else {
        if (!target[key]) {
          dst[key] = src[key];
        } else {
          dst[key] = deepmerge(target[key], src[key]);
        }
      }
    });
  }

  return dst;
}

module.exports = function (grunt) {
  grunt.registerMultiTask('jsonAngularTranslate', 'The best Grunt plugin ever.', function () {
    var extractLanguage;
    var options = this.options({
      moduleName: 'translations',
      extractLanguage: /..(?=\.[^.]*$)/,
      hasPreferredLanguage: true,
      createNestedKeys: true
    });

    if (typeof(options.extractLanguage) === 'function') {
      extractLanguage = options.extractLanguage;
    } else {
      extractLanguage = function (filepath) {
        return filepath.match(options.extractLanguage)[0];
      };
    }

    this.files.forEach(function (file) {
      // Concat specified files.
      var language,
          keys,
          src = {};

      file.src.filter(function (filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(function (filepath) {
        // Read file source.
        var currLanguage = extractLanguage(filepath);
        if (language && language !== currLanguage) {
          throw 'inconsistent language: ' + filepath + ' (' + currLanguage + ' !== ' + language + ')';
        }
        language = currLanguage;

        var processor = (options.createNestedKeys ? unflatten : reverse);
        src = deepmerge(processor(JSON.parse(grunt.file.read(filepath))), src);
      }).reduce(extend, {});

      src = grunt.template.process(multiline(function(){/*
'use strict';

try {
  angular.module('<%= moduleName %>');
} catch (e) {
  angular.module('<%= moduleName %>', ['pascalprecht.translate']);
}

angular.module('<%= moduleName %>').config(['$translateProvider', function ($translateProvider) {
  var translations = <%= translations %>;
  $translateProvider.translations('<%= language %>', translations);
  $translateProvider.translations(translations);
  if ($translateProvider.preferredLanguage) {
      $translateProvider.preferredLanguage('<%= language %>');
  }
}]).value('preferredLanguage', '<%= language %>');
      */}), {data: {language: language, moduleName: options.moduleName, translations: toSingleQuotes(JSON.stringify(src))}});

      src = jb(src, {'indent_size': 2, 'jslint_happy': true}) + '\n';

      grunt.file.write(file.dest, src);

      grunt.log.writeln('File "' + file.dest + '" created.');
    });
  });

};
