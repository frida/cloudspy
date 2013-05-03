/*global module:false*/
module.exports = function(grunt) {
    'use strict';

    grunt.initConfig({
        requirejs: {
            rel: {
                options: {
                    modules: [{
                        name: 'main'
                    }],
                    dir: "build/www",
                    appDir: "src",
                    baseUrl: ".",
                    paths: {
                        'lcss':         "vendor/lcss",
                        'text':         "vendor/text",
                        'deferred':     "js/lib/deferred",
                        'events':       "js/lib/events",
                        'extend':       "js/lib/extend",
                        'lru':          "js/lib/lru",
                        'app':          "js/app",
                        'main':         "js/main",
                        'css':          "css"
                    },

                    optimize: "uglify2",
                    optimizeAllPluginResources: true,
                    optimizeCss: 'none', /* LESS compiler takes care of this */
                    stubModules: [ 'lcss', 'text' ],
                    removeCombined: true,

                    almond: true,
                    replaceRequireScript: [{
                        files: ["build/www/index.html"],
                        module: 'main',
                        modulePath: '/js/main'
                    }],

                    fileExclusionRegExp: /^\..+$/,
                    pragmas: { productionExclude: true },
                    preserveLicenseComments: false,
                    useStrict: false
                }
            }
        },
        jshint: {
            all: [
                'Gruntfile.js',
                'src/js/*.js',
                'src/js/app/**/*.js',
                'rel/*.js'
            ],
            options: {
                jshintrc: ".jshintrc"
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-requirejs');

    grunt.registerTask('build', ['requirejs', 'trim']);
    grunt.registerTask('lint', ['jshint']);
    grunt.registerTask('default', ['lint']);

    grunt.registerTask('trim', "Trim for packaging.", function() {
        var fs = require('fs');
        var path = require('path');
        var targets = grunt.config(['requirejs']);

        function rmTreeSync(name) {
            if (!fs.existsSync(name)) {
                return;
            }

            if (fs.statSync(name).isDirectory()) {
                fs.readdirSync(name).forEach(function(file) {
                    rmTreeSync(path.join(name, file));
                });
                fs.rmdirSync(name);
            } else {
                fs.unlinkSync(name);
            }
        }

        for (var target in targets) {
            if (targets.hasOwnProperty(target)) {
                var dir = targets[target].options.dir;

                var htmlFilepath = path.join(dir, "index.html");
                var htmlDoc = grunt.file.read(htmlFilepath);
                grunt.file.write(htmlFilepath, htmlDoc.
                    replace(/"\/css\/app\.css"/, "\"/app.css\"").
                    replace(/"\/js\/config\.js"/, "\"/config.js\"").
                    replace(/"\/js\/main\.js"/, "\"/app.js\"")
                );

                grunt.file.copy(path.join(dir, "css", "app.css"), path.join(dir, "app.css"));
                grunt.file.copy(path.join(dir, "js", "config.js"), path.join(dir, "config.js"));
                grunt.file.copy(path.join(dir, "js", "main.js"), path.join(dir, "app.js"));

                rmTreeSync(path.join(dir, "build.txt"));
                rmTreeSync(path.join(dir, "css"));
                rmTreeSync(path.join(dir, "js"));
                rmTreeSync(path.join(dir, "templates"));
                rmTreeSync(path.join(dir, "vendor"));
            }
        }
    });
};
